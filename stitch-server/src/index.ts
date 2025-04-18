import { Router, RouterType, IRequest } from 'itty-router';
import { D1ThreadClient, createTracingD1Database } from '../../stitch-ui/app/clients/d1';
import type { ThreadCreateData, PostCreateData, Webhook } from '../../stitch-ui/app/clients/types';
import { ApiOperation, generateOpenApiSpec } from './openapi';

export interface Env {
	DB: D1Database;
	router?: RouterType;
	threadClient?: D1ThreadClient;
	API_KEY: string;
	BUCKET1?: R2Bucket;
}

interface DocumentCreateRequest {
	thread_id: number;
	title: string;
	content: string;
	type: string;
}

interface WebhookCreateRequest {
	url: string;
	api_key?: string;
}

interface ApiKeyUpdateRequest {
	permissions: string;
}

interface PostUpdateRequest {
	text: string;
	image?: File;
}

/**
 * Helper function to trigger webhooks for various events
 * @param threadClient The thread client instance
 * @param threadId The thread ID associated with the event
 * @param eventType The type of event (post_created, post_updated, etc.)
 * @param data The data to send with the webhook (post or document object)
 */
async function triggerWebhooks(threadClient: D1ThreadClient, threadId: number, eventType: string, data: any): Promise<void> {
	try {
		// Get all webhooks for this thread
		const webhooks = await threadClient.getThreadWebhooks(threadId);

		if (!webhooks || webhooks.length === 0) {
			return; // No webhooks to trigger
		}

		// Prepare the payload
		const payload = {
			event: eventType,
			data,
			timestamp: new Date().toISOString(),
		};

		// Convert payload to JSON string - we'll use this for both the request body and signature
		const payloadString = JSON.stringify(payload);

		// Trigger each webhook in parallel
		const webhookPromises = webhooks.map(async (webhook: Webhook) => {
			try {
				// Set up basic headers
				const headers: HeadersInit = { 'Content-Type': 'application/json' };

				// Generate HMAC-SHA256 signature if a secret is provided
				if (webhook.api_key) {
					// Use Web Crypto API to generate the HMAC signature
					// First, encode the message and key
					const encoder = new TextEncoder();
					const messageUint8 = encoder.encode(payloadString);
					const keyUint8 = encoder.encode(webhook.api_key);

					// Import the key
					const key = await crypto.subtle.importKey('raw', keyUint8, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

					// Sign the message
					const signature = await crypto.subtle.sign('HMAC', key, messageUint8);

					// Convert the signature to hex
					const signatureHex = Array.from(new Uint8Array(signature))
						.map((b) => b.toString(16).padStart(2, '0'))
						.join('');

					// Add the signature to the headers
					headers['X-Webhook-Signature'] = signatureHex;
				}

				// Send the webhook request
				const response = await fetch(webhook.url, {
					method: 'POST',
					headers,
					body: payloadString,
				});

				const _body = await response.text();

				// Update the last triggered timestamp
				if (response.status >= 200 && response.status < 300) {
					await threadClient.updateWebhookLastTriggered(webhook.id);
				}

				return { webhookId: webhook.id, success: response.ok, status: response.status };
			} catch (error) {
				console.error(`[TRACE] Error triggering webhook ${webhook.id}:`, error);
				return { webhookId: webhook.id, success: false, error: String(error) };
			}
		});

		await Promise.all(webhookPromises).then((results) => {
			console.log(`[TRACE] Webhook results:`, results);
		});
	} catch (error) {
		console.error(`[TRACE] Error in triggerWebhooks:`, error);
	}
}

/**
 * Decorator for route tracing.
 * Logs method entry (with the request URL), exit (with duration), and errors.
 */
function routeTrace(target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
	const originalMethod = descriptor.value;

	descriptor.value = async function (request: IRequest) {
		const start = Date.now();
		try {
			const result = await originalMethod.call(this, request);
			console.log(`[TRACE] Exiting ${String(propertyKey)} in ${Date.now() - start}ms`);
			return result;
		} catch (error) {
			console.error(`[TRACE] Error in ${String(propertyKey)}:`, error);
			throw error;
		}
	};
	return descriptor;
}

// Helper function to compose decorators
function compose(
	...decorators: Array<
		(
			target: any,
			propertyKey: string | symbol,
			descriptor: TypedPropertyDescriptor<(request: IRequest) => Promise<Response>>
		) => TypedPropertyDescriptor<(request: IRequest) => Promise<Response>>
	>
): MethodDecorator {
	return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
		return decorators.reduceRight((desc, decorator) => {
			return decorator(target, propertyKey, desc as TypedPropertyDescriptor<(request: IRequest) => Promise<Response>>) || desc;
		}, descriptor);
	};
}

/**
 * Middleware class to handle authentication.
 */
class ApiMiddleware {
	constructor(private env: Env) {}

	// @ts-ignore - Method decorator type compatibility
	@routeTrace
	async auth(request: Request): Promise<Response | void> {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			console.log('[TRACE] Missing API key');
			return new Response('Missing API key', { status: 401 });
		}
		const apiKey = authHeader.split('Bearer ')[1];
		let useDefaultAuthCheck = true;
		if (apiKey.startsWith('narrow_')) {
			const narrowToken = apiKey.split('_')[1];

			// TODO: make this better and less error prone
			const urlParts = request.url.split('/');

			let foundThreadId = '';
			let foundThread = false;
			for (const part of urlParts) {
				if (foundThread) {
					// if its latest continue one more time
					if (part === 'latest') {
						continue;
					}

					foundThreadId = part;
					break;
				}
				if (part === 'threads') {
					foundThread = true;
				}
			}

			if (foundThreadId === '') {
				console.log('[TRACE] Thread ID not found');
				return new Response('Thread ID not found', { status: 404 });
			}
			const threadId = foundThreadId;

			return this.env.threadClient!.getThread(Number(threadId)).then((thread) => {
				if (thread) {
					if (thread.share_pubkey === narrowToken) {
						console.log('[TRACE] Narrow token matches');
						useDefaultAuthCheck = false;
					} else {
						console.log('[TRACE] Narrow token does not match');
						return new Response('Invalid narrow token', { status: 403 });
					}
				} else {
					console.log('[TRACE] Thread not found');
					return new Response('Thread not found', { status: 404 });
				}
			});
		}
		if (useDefaultAuthCheck) {
			// now we need to check if its the master key (for the whole api)
			// or if its a thread key

			if (apiKey === this.env.API_KEY) {
				console.log('[TRACE] Valid API key');
				return;
			}

			// now before exiting theres a chance that its a thread key

			const urlParts = request.url.split('/');
			let foundThreadId = '';
			let foundThread = false;
			for (const part of urlParts) {
				if (foundThread) {
					// if its latest continue one more time
					if (part === 'latest') {
						continue;
					}

					foundThreadId = part;
					break;
				}
				if (part === 'threads') {
					foundThread = true;
				}
			}

			if (foundThreadId === '') {
				console.log('[TRACE] Thread ID not found');
				return new Response('Thread ID not found and invalid API key', { status: 404 });
			}

			const threadId = foundThreadId;
			const threadApiKeys = await this.env.threadClient!.getThreadApiKeys(Number(threadId));

			console.log(apiKey);

			const matchingThreadKey = threadApiKeys.find((threadApiKey) => {
				return threadApiKey.api_key === apiKey;
			});

			console.log(matchingThreadKey);

			if (matchingThreadKey) {
				// Parse the stored permissions
				let permissions;
				try {
					let permissionsString = matchingThreadKey.permissions;
					permissions = JSON.parse(permissionsString);
				} catch (e) {
					console.log('[TRACE] Invalid permissions format:', matchingThreadKey.permissions);
					permissions = { read: false, write: false, delete: false };
				}

				console.log('CAN WRITE', permissions.write);
				console.log('CAN READ', permissions.read);
				console.log('CAN DELETE', permissions.delete);

				// Enforce permissions based on request method
				const method = request.method.toUpperCase();

				// GET requests require read permission
				if (method === 'GET' && !permissions.read) {
					console.log('[TRACE] Read permission denied');
					return new Response('Insufficient permissions: read access required', { status: 403 });
				}

				// POST and PUT requests require write permission
				if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && !permissions.write) {
					console.log('[TRACE] Write permission denied');
					return new Response('Insufficient permissions: write access required', { status: 403 });
				}

				// DELETE requests require delete permission
				if (method === 'DELETE' && !permissions.delete) {
					console.log('[TRACE] Delete permission denied');
					return new Response('Insufficient permissions: delete access required', { status: 403 });
				}

				// If we get here, the permission check passed
				console.log('[TRACE] Valid thread API key with permissions:', permissions);

				return;
			}
			return new Response('Invalid API key', { status: 403 });
		}
	}
}

/**
 * Class containing all API route handlers.
 */
class ApiRoutes {
	middleware: ApiMiddleware;

	constructor(private env: Env) {
		this.middleware = new ApiMiddleware(env);
	}

	@ApiOperation({
		path: '/api/docs/openapi.json',
		method: 'get',
		summary: 'Get OpenAPI Specification',
		description: 'Returns the OpenAPI specification for the API',
		tags: ['Documentation'],
		responses: {
			'200': {
				description: 'OpenAPI specification',
				content: {
					'application/json': {
						schema: {
							type: 'object',
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getOpenApiSpec(request: IRequest): Promise<Response> {
		return Response.json(generateOpenApiSpec());
	}

	@ApiOperation({
		path: '/api/threads',
		method: 'get',
		summary: 'Get all threads',
		description: 'Returns a list of all threads',
		tags: ['Threads'],
		responses: {
			'200': {
				description: 'List of threads',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								$ref: '#/components/schemas/Thread',
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getThreads(request: IRequest): Promise<Response> {
		try {
			const threads = await this.env.threadClient!.getThreads();
			return Response.json(threads);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}',
		method: 'get',
		summary: 'Get thread by ID',
		description: 'Returns a single thread by its ID',
		tags: ['Threads'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to retrieve',
			},
		],
		responses: {
			'200': {
				description: 'Thread found',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Thread',
						},
					},
				},
			},
			'404': {
				description: 'Thread not found',
			},
		},
	})
	@routeTrace
	async getThreadById(request: IRequest): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		const thread = await this.env.threadClient!.getThread(id);
		if (!thread) {
			return new Response('Thread not found', { status: 404 });
		}
		return Response.json(thread);
	}

	@ApiOperation({
		path: '/api/threads',
		method: 'post',
		summary: 'Create a new thread',
		description: 'Creates a new thread with the provided details',
		tags: ['Threads'],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							title: { type: 'string' },
							creator: { type: 'string' },
						},
						required: ['title', 'creator'],
					},
				},
				'multipart/form-data': {
					schema: {
						type: 'object',
						properties: {
							title: { type: 'string' },
							creator: { type: 'string' },
						},
						required: ['title', 'creator'],
					},
				},
			},
		},
		responses: {
			'201': {
				description: 'Thread created successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Thread',
						},
					},
				},
			},
			'400': {
				description: 'Invalid request',
			},
		},
	})
	@routeTrace
	async createThread(request: IRequest): Promise<Response> {
		try {
			const data = await request.formData();
			const imageFile = data.get('image');
			let image: File | undefined = undefined;

			if (imageFile && typeof imageFile !== 'string') {
				image = imageFile as File;
			}

			const threadData: ThreadCreateData = {
				title: data.get('title') as string,
				creator: data.get('creator') as string,
				initial_post: data.get('initial_post') as string,
				image,
			};
			const thread = await this.env.threadClient!.createThread(threadData);

			// Trigger webhooks for thread_created event - for the initial post
			if (thread && thread.posts && thread.posts.length > 0) {
				const initialPost = thread.posts[0];
				await triggerWebhooks(this.env.threadClient!, thread.id, 'post_created', initialPost);

				// Also trigger a thread_created event
				await triggerWebhooks(this.env.threadClient!, thread.id, 'thread_created', thread);
			}

			return Response.json(thread);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}',
		method: 'delete',
		summary: 'Delete a thread',
		description: 'Deletes a thread by its ID',
		tags: ['Threads'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to delete',
			},
		],
		responses: {
			'200': {
				description: 'Thread deleted successfully',
			},
			'404': {
				description: 'Thread not found',
			},
		},
	})
	@routeTrace
	async deleteThread(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			// Get thread data before deletion for the webhook payload
			const thread = await this.env.threadClient!.getThread(id);

			if (thread) {
				// Trigger webhooks for thread_deleted event before deleting the thread
				await triggerWebhooks(this.env.threadClient!, id, 'thread_deleted', thread);
			}

			await this.env.threadClient!.deleteThread(id);
			return Response.json({ message: 'Thread deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}',
		method: 'put',
		summary: 'Update a thread',
		description: 'Updates a thread by its ID',
		tags: ['Threads'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to update',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							title: { type: 'string' },
						},
					},
				},
			},
		},
		responses: {
			'200': {
				description: 'Thread updated successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Thread',
						},
					},
				},
			},
			'404': {
				description: 'Thread not found',
			},
		},
	})
	@routeTrace
	async updateThread(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = await request.formData();
			const title = data.get('title') as string;
			const sharePubkey = data.get('sharePubkey') as string;
			const threadData = { title, sharePubkey };
			const thread = await this.env.threadClient!.updateThread(id, threadData);

			// Trigger webhooks for thread_updated event
			await triggerWebhooks(this.env.threadClient!, id, 'thread_updated', thread);

			return Response.json(thread);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}/posts',
		method: 'post',
		summary: 'Create a user post',
		description: 'Creates a new user post in a thread',
		tags: ['Posts'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to create post in',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							text: { type: 'string' },
						},
						required: ['text'],
					},
				},
			},
		},
		responses: {
			'201': {
				description: 'Post created successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Post',
						},
					},
				},
			},
		},
	})
	@routeTrace
	async createUserPost(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}

		// check if form data or json
		const contentType = request.headers.get('content-type');
		console.log(contentType);

		// Check if the content type is multipart/form-data or application/json
		const isMultiPart = contentType && contentType.includes('multipart/form-data');
		const isJson = contentType && contentType.includes('application/json');
		if (!isMultiPart && !isJson) {
			return new Response('Invalid content type', { status: 400 });
		}

		try {
			let postData: PostCreateData;

			if (isJson) {
				const data = await request.json();
				postData = {
					text: data.text as string,
					image: data.image as File | undefined,
				};
			} else {
				const data = await request.formData();
				postData = {
					text: data.get('text') as string,
					image: data.get('image') as File | undefined,
				};
			}

			console.log(postData);
			const post = await this.env.threadClient!.createPost(id, postData, 'user');

			// Trigger webhooks for post_created event
			await triggerWebhooks(this.env.threadClient!, id, 'post_created', post);

			return Response.json(post);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/system/threads/{threadId}/posts',
		method: 'post',
		summary: 'Create a system post',
		description: 'Creates a new system post in a thread',
		tags: ['Posts'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to create system post in',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							text: { type: 'string' },
						},
						required: ['text'],
					},
				},
			},
		},
		responses: {
			'201': {
				description: 'System post created successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Post',
						},
					},
				},
			},
		},
	})
	@routeTrace
	async createSystemPost(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = (await request.json()) as PostCreateData;
			const post = await this.env.threadClient!.createPost(id, data, 'system');

			// Trigger webhooks for post_created event
			await triggerWebhooks(this.env.threadClient!, id, 'post_created', post);

			return Response.json(post);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}/posts',
		method: 'get',
		summary: 'Get posts for a thread',
		description: 'Returns all posts for a thread',
		tags: ['Posts'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to retrieve posts from',
			},
		],
		responses: {
			'200': {
				description: 'List of posts',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								$ref: '#/components/schemas/Post',
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getPosts(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const posts = await this.env.threadClient!.getPosts(id);
			return Response.json(posts);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/latest/{threadId}/{limit}/{lastPostTime}',
		method: 'get',
		summary: 'Get latest posts for a thread',
		description: 'Returns the latest posts for a thread based on the limit and lastPostTime parameters',
		tags: ['Posts'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to retrieve posts from',
			},
			{
				name: 'limit',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'Maximum number of posts to retrieve',
			},
			{
				name: 'lastPostTime',
				in: 'path',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'Timestamp of the last post retrieved',
			},
		],
		responses: {
			'200': {
				description: 'List of latest posts',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								$ref: '#/components/schemas/Post',
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getLatestPosts(request: Request): Promise<Response> {
		const { threadId: _threadId, limit: _limit, lastPostTime: _lastPostTime } = (request as any).params;
		const threadId = Number(_threadId);
		const timeCursor = Number(_lastPostTime);
		const limit = Number(_limit);

		let lastPostTime = undefined;
		if (timeCursor > 0) {
			lastPostTime = timeCursor;
		}
		if (isNaN(threadId)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const posts = await this.env.threadClient!.getLatestPosts(threadId, limit, lastPostTime);
			return Response.json(posts);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}/documents',
		method: 'get',
		summary: 'Get documents for a thread',
		description: 'Returns all documents for a thread',
		tags: ['Documents'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to retrieve documents from',
			},
		],
		responses: {
			'200': {
				description: 'List of documents',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								$ref: '#/components/schemas/Document',
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getDocuments(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const documents = await this.env.threadClient!.getThreadDocuments(id);
			return Response.json(documents);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/documents',
		method: 'post',
		summary: 'Create a document',
		description: 'Creates a new document',
		tags: ['Documents'],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							thread_id: { type: 'integer' },
							title: { type: 'string' },
							content: { type: 'string' },
							type: { type: 'string' },
						},
						required: ['thread_id', 'title', 'content', 'type'],
					},
				},
			},
		},
		responses: {
			'201': {
				description: 'Document created successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Document',
						},
					},
				},
			},
		},
	})
	@routeTrace
	async createDocument(request: Request): Promise<Response> {
		try {
			const data = await request.formData();
			const postData: {
				title: string;
				content: string;
				type: string;
				file?: File;
			} = {
				title: data.get('title') as string,
				content: data.get('content') as string,
				type: data.get('type') as string,
				file: data.get('file') as File,
			};
			const threadId = Number(data.get('threadId'));
			const document = await this.env.threadClient!.createDocument(threadId, postData);

			// Trigger webhooks for document_created event
			await triggerWebhooks(this.env.threadClient!, threadId, 'document_created', document);

			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/documents/{docId}',
		method: 'get',
		summary: 'Get document by ID',
		description: 'Returns a document by its ID',
		tags: ['Documents'],
		parameters: [
			{
				name: 'docId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the document to retrieve',
			},
		],
		responses: {
			'200': {
				description: 'Document found',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Document',
						},
					},
				},
			},
			'404': {
				description: 'Document not found',
			},
		},
	})
	@routeTrace
	async getDocument(request: Request): Promise<Response> {
		const { docId } = (request as any).params;
		try {
			const document = await this.env.threadClient!.getDocument(docId);
			if (!document) {
				return new Response('Document not found', { status: 404 });
			}
			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/documents/{docId}',
		method: 'delete',
		summary: 'Delete a document',
		description: 'Deletes a document by its ID',
		tags: ['Documents'],
		parameters: [
			{
				name: 'docId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the document to delete',
			},
		],
		responses: {
			'200': {
				description: 'Document deleted successfully',
			},
			'404': {
				description: 'Document not found',
			},
		},
	})
	@routeTrace
	async deleteDocument(request: Request): Promise<Response> {
		const { docId } = (request as any).params;
		try {
			// Get document data before deletion for the webhook payload
			const document = await this.env.threadClient!.getDocument(docId);
			if (document) {
				await this.env.threadClient!.deleteDocument(docId);

				// Trigger webhooks for document_deleted event
				if (document.thread_id) {
					await triggerWebhooks(this.env.threadClient!, document.thread_id, 'document_deleted', document);
				}

				return Response.json({ message: 'Document deleted' });
			} else {
				return new Response('Document not found', { status: 404 });
			}
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/documents/{docId}',
		method: 'put',
		summary: 'Update a document',
		description: 'Updates a document by its ID',
		tags: ['Documents'],
		parameters: [
			{
				name: 'docId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the document to update',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							title: { type: 'string' },
							content: { type: 'string' },
							type: { type: 'string' },
						},
					},
				},
			},
		},
		responses: {
			'200': {
				description: 'Document updated successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Document',
						},
					},
				},
			},
			'404': {
				description: 'Document not found',
			},
		},
	})
	@routeTrace
	async updateDocument(request: Request): Promise<Response> {
		try {
			const { docId } = (request as any).params;
			const data = (await request.json()) as DocumentCreateRequest;
			const document = await this.env.threadClient!.updateDocument(docId, {
				title: data.title,
				content: data.content,
				type: data.type,
			});

			// Trigger webhooks for document_updated event
			if (document && document.thread_id) {
				await triggerWebhooks(this.env.threadClient!, document.thread_id, 'document_updated', document);
			}

			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}/webhooks',
		method: 'get',
		summary: 'Get webhooks for a thread',
		description: 'Returns all webhooks for a thread',
		tags: ['Webhooks'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to retrieve webhooks from',
			},
		],
		responses: {
			'200': {
				description: 'List of webhooks',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'integer' },
									thread_id: { type: 'integer' },
									url: { type: 'string' },
								},
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getWebhooks(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const webhooks = await this.env.threadClient!.getThreadWebhooks(id);
			return Response.json(webhooks);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}/webhooks',
		method: 'post',
		summary: 'Add a webhook',
		description: 'Adds a new webhook to a thread',
		tags: ['Webhooks'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to add webhook to',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							url: { type: 'string' },
							api_key: { type: 'string' },
						},
						required: ['url'],
					},
				},
			},
		},
		responses: {
			'201': {
				description: 'Webhook added successfully',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								id: { type: 'integer' },
								thread_id: { type: 'integer' },
								url: { type: 'string' },
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async addWebhook(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = (await request.json()) as WebhookCreateRequest;
			await this.env.threadClient!.addWebhook(id, data.url, data.api_key);
			const webhooks = await this.env.threadClient!.getThreadWebhooks(id);
			return Response.json(webhooks[webhooks.length - 1]);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/webhooks/{webhookId}',
		method: 'delete',
		summary: 'Delete a webhook',
		description: 'Deletes a webhook by its ID',
		tags: ['Webhooks'],
		parameters: [
			{
				name: 'webhookId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the webhook to delete',
			},
		],
		responses: {
			'200': {
				description: 'Webhook deleted successfully',
			},
			'404': {
				description: 'Webhook not found',
			},
		},
	})
	@routeTrace
	async deleteWebhook(request: Request): Promise<Response> {
		const { webhookId } = (request as any).params;
		const id = Number(webhookId);
		if (isNaN(id)) {
			return new Response('Invalid webhook ID', { status: 400 });
		}
		try {
			await this.env.threadClient!.removeWebhook(id);
			return Response.json({ message: 'Webhook deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/posts/{postId}',
		method: 'get',
		summary: 'Get post by ID',
		description: 'Returns a post by its ID',
		tags: ['Posts'],
		parameters: [
			{
				name: 'postId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the post to retrieve',
			},
		],
		responses: {
			'200': {
				description: 'Post found',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Post',
						},
					},
				},
			},
			'404': {
				description: 'Post not found',
			},
		},
	})
	@routeTrace
	async getPost(request: Request): Promise<Response> {
		const { postId } = (request as any).params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		// update post view count
		await this.env.threadClient!.updatePostView(id);
		const post = await this.env.threadClient!.getPost(id);
		if (!post) {
			return new Response('Post not found', { status: 404 });
		}
		return Response.json(post);
	}

	@ApiOperation({
		path: '/api/posts/{postId}',
		method: 'put',
		summary: 'Update a post',
		description: 'Updates a post by its ID',
		tags: ['Posts'],
		parameters: [
			{
				name: 'postId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the post to update',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							text: { type: 'string' },
						},
						required: ['text'],
					},
				},
			},
		},
		responses: {
			'200': {
				description: 'Post updated successfully',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/Post',
						},
					},
				},
			},
			'404': {
				description: 'Post not found',
			},
		},
	})
	@routeTrace
	async updatePost(request: Request): Promise<Response> {
		const { postId } = (request as any).params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		const data = (await request.json()) as PostUpdateRequest;
		const post = await this.env.threadClient!.updatePost(id, data);
		if (!post) {
			return new Response('Post not found', { status: 404 });
		}

		// Trigger webhooks for post_updated event
		if (post.thread_id) {
			await triggerWebhooks(this.env.threadClient!, post.thread_id, 'post_updated', post);
		}

		return Response.json(post);
	}

	@ApiOperation({
		path: '/api/posts/{postId}',
		method: 'delete',
		summary: 'Delete a post',
		description: 'Deletes a post by its ID',
		tags: ['Posts'],
		parameters: [
			{
				name: 'postId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the post to delete',
			},
		],
		responses: {
			'200': {
				description: 'Post deleted successfully',
			},
			'404': {
				description: 'Post not found',
			},
		},
	})
	@routeTrace
	async deletePost(request: Request): Promise<Response> {
		const { postId } = (request as any).params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}

		try {
			// Get post data before deletion for the webhook payload
			const post = await this.env.threadClient!.getPost(id);

			if (post) {
				const threadId = post.thread_id;
				await this.env.threadClient!.deletePost(id);

				// Trigger webhooks for post_deleted event
				await triggerWebhooks(this.env.threadClient!, threadId, 'post_deleted', post);
			} else {
				await this.env.threadClient!.deletePost(id);
			}

			return Response.json({ message: 'Post deleted' });
		} catch (e: any) {
			console.error('Error in deletePost:', e);
			return new Response(e.message, { status: 500 });
		}
	}

	@ApiOperation({
		path: '/api/thread/{threadId}/apikeys',
		method: 'get',
		summary: 'Get API keys for a thread',
		description: 'Returns all API keys for a thread',
		tags: ['API Keys'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to retrieve API keys from',
			},
		],
		responses: {
			'200': {
				description: 'List of API keys',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									key: { type: 'string' },
									name: { type: 'string' },
									permissions: { type: 'string' },
								},
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getApiKeys(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		const keys = await this.env.threadClient!.getThreadApiKeys(id);
		return Response.json(keys);
	}

	@ApiOperation({
		path: '/api/thread/{threadId}/apikeys',
		method: 'post',
		summary: 'Add an API key',
		description: 'Adds a new API key to a thread',
		tags: ['API Keys'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to add API key to',
			},
		],
		responses: {
			'201': {
				description: 'API key added successfully',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								key: { type: 'string' },
								name: { type: 'string' },
								permissions: { type: 'string' },
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async addApiKey(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}

		const data = await request.json();

		// Use provided key name or generate a random one
		const keyName = data.name || 'key_' + crypto.randomUUID().split('-')[0];

		// Set default permissions to read-only for new keys
		const defaultPermissions = JSON.stringify({
			read: true,
			write: false,
			delete: false,
		});

		// Generate random API key
		const randomKey = crypto.randomUUID();

		const key = await this.env.threadClient!.createAPIKey(id, keyName, defaultPermissions);
		return Response.json(key);
	}

	@ApiOperation({
		path: '/api/apikeys/{apiKey}',
		method: 'delete',
		summary: 'Delete an API key',
		description: 'Deletes an API key by its value',
		tags: ['API Keys'],
		parameters: [
			{
				name: 'apiKey',
				in: 'path',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'API key to delete',
			},
		],
		responses: {
			'200': {
				description: 'API key deleted successfully',
			},
		},
	})
	@routeTrace
	async deleteApiKey(request: Request): Promise<Response> {
		const { apiKey } = (request as any).params;
		await this.env.threadClient!.deleteAPIKey(apiKey);
		return Response.json({ message: 'API key deleted' });
	}

	@ApiOperation({
		path: '/api/apikeys/{apiKey}',
		method: 'put',
		summary: 'Update an API key',
		description: 'Updates permissions for an API key',
		tags: ['API Keys'],
		parameters: [
			{
				name: 'apiKey',
				in: 'path',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'API key to update',
			},
		],
		requestBody: {
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							permissions: { type: 'string' },
						},
						required: ['permissions'],
					},
				},
			},
		},
		responses: {
			'200': {
				description: 'API key updated successfully',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								key: { type: 'string' },
								name: { type: 'string' },
								permissions: { type: 'string' },
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async updateApiKey(request: Request): Promise<Response> {
		const { keyId } = (request as any).params;
		const data = (await request.json()) as ApiKeyUpdateRequest;

		// Ensure permissions is properly formatted as a JSON string containing read/write/delete boolean values
		let permissionsJson: string;

		// If permissions is already a string, validate it's proper JSON
		if (typeof data.permissions === 'string') {
			try {
				const parsed = JSON.parse(data.permissions);
				if (typeof parsed.read !== 'boolean' || typeof parsed.write !== 'boolean' || typeof parsed.delete !== 'boolean') {
					// Add default values if missing
					parsed.read = parsed.read ?? false;
					parsed.write = parsed.write ?? false;
					parsed.delete = parsed.delete ?? false;
				}
				permissionsJson = JSON.stringify(parsed);
			} catch (e) {
				// If invalid JSON, create default permissions
				permissionsJson = JSON.stringify({ read: true, write: false, delete: false });
			}
		} else if (typeof data.permissions === 'object' && data.permissions !== null) {
			// If it's already an object, ensure it has the required properties
			const permissions = {
				read: Boolean(data.permissions.read),
				write: Boolean(data.permissions.write),
				delete: Boolean(data.permissions.delete),
			};
			permissionsJson = JSON.stringify(permissions);
		} else {
			// Default to read-only permissions
			permissionsJson = JSON.stringify({ read: true, write: false, delete: false });
		}

		console.log(permissionsJson);

		const updated = await this.env.threadClient!.updateAPIKey(keyId, permissionsJson);
		return Response.json(updated);
	}

	@ApiOperation({
		path: '/api/upload',
		method: 'post',
		summary: 'Upload a file',
		description: 'Uploads a file to the server',
		tags: ['Files'],
		requestBody: {
			content: {
				'multipart/form-data': {
					schema: {
						type: 'object',
						properties: {
							file: {
								type: 'string',
								format: 'binary',
							},
						},
						required: ['file'],
					},
				},
			},
		},
		responses: {
			'201': {
				description: 'File uploaded successfully',
			},
			'501': {
				description: 'File upload not implemented',
			},
		},
	})
	@routeTrace
	async uploadFile(request: Request): Promise<Response> {
		return new Response('File upload not implemented', { status: 501 });
	}

	@ApiOperation({
		path: '/api/uploads/{fileId}',
		method: 'get',
		summary: 'Get a file',
		description: 'Retrieves a file by its ID',
		tags: ['Files'],
		parameters: [
			{
				name: 'fileId',
				in: 'path',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'ID of the file to retrieve',
			},
		],
		responses: {
			'200': {
				description: 'File content',
				content: {
					'application/octet-stream': {
						schema: {
							type: 'string',
							format: 'binary',
						},
					},
				},
			},
			'404': {
				description: 'File not found',
			},
		},
	})
	@routeTrace
	async getFile(request: Request): Promise<Response> {
		const { fileId } = (request as any).params;
		const _fileId = `uploads/${fileId}`;
		const file = await this.env.threadClient!.getPostImage(_fileId);
		if (!file) {
			return new Response('File not found', { status: 404 });
		}
		const buffer = await file.arrayBuffer();
		return new Response(buffer, {
			headers: {
				'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
				'Content-Length': file.size.toString(),
				ETag: file.httpEtag,
				'Cache-Control': 'public, max-age=31536000',
			},
		});
	}

	@ApiOperation({
		path: '/api/search',
		method: 'get',
		summary: 'Search posts across all threads',
		description: 'Returns posts matching the search query across all threads',
		tags: ['Search'],
		parameters: [
			{
				name: 'q',
				in: 'query',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'Search query string',
			},
			{
				name: 'limit',
				in: 'query',
				required: false,
				schema: {
					type: 'integer',
					default: 20,
				},
				description: 'Maximum number of results to return',
			},
			{
				name: 'offset',
				in: 'query',
				required: false,
				schema: {
					type: 'integer',
					default: 0,
				},
				description: 'Number of results to skip (for pagination)',
			},
		],
		responses: {
			'200': {
				description: 'Search results',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								results: {
									type: 'array',
									items: {
										$ref: '#/components/schemas/Post',
									},
								},
								total: {
									type: 'integer',
								},
							},
						},
					},
				},
			},
			'400': {
				description: 'Invalid request parameters',
			},
		},
	})
	@routeTrace
	async searchAllPosts(request: IRequest): Promise<Response> {
		try {
			const url = new URL(request.url);
			const query = url.searchParams.get('q');

			if (!query) {
				return new Response('Search query parameter "q" is required', { status: 400 });
			}

			const limit = parseInt(url.searchParams.get('limit') || '20', 10);
			const offset = parseInt(url.searchParams.get('offset') || '0', 10);

			const posts = await this.env.threadClient!.searchPosts(query, null, limit, offset);
			const stats = await this.env.threadClient!.getSearchStats(query);

			return Response.json({
				results: posts,
				total: stats.count,
			});
		} catch (error: any) {
			console.error('Search error:', error);
			return new Response(
				JSON.stringify({
					success: false,
					error: error.message || 'An error occurred while searching',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	}

	@ApiOperation({
		path: '/api/threads/{threadId}/search',
		method: 'get',
		summary: 'Search posts within a specific thread',
		description: 'Returns posts matching the search query within a specific thread',
		tags: ['Search'],
		parameters: [
			{
				name: 'threadId',
				in: 'path',
				required: true,
				schema: {
					type: 'integer',
				},
				description: 'ID of the thread to search within',
			},
			{
				name: 'q',
				in: 'query',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'Search query string',
			},
			{
				name: 'limit',
				in: 'query',
				required: false,
				schema: {
					type: 'integer',
					default: 20,
				},
				description: 'Maximum number of results to return',
			},
			{
				name: 'offset',
				in: 'query',
				required: false,
				schema: {
					type: 'integer',
					default: 0,
				},
				description: 'Number of results to skip (for pagination)',
			},
		],
		responses: {
			'200': {
				description: 'Search results',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								results: {
									type: 'array',
									items: {
										$ref: '#/components/schemas/Post',
									},
								},
								total: {
									type: 'integer',
								},
							},
						},
					},
				},
			},
			'400': {
				description: 'Invalid request parameters',
			},
		},
	})
	@routeTrace
	async searchThreadPosts(request: IRequest): Promise<Response> {
		try {
			const { threadId } = (request as any).params;
			const id = Number(threadId);

			if (isNaN(id)) {
				return new Response('Invalid thread ID', { status: 400 });
			}

			const url = new URL(request.url);
			const query = url.searchParams.get('q');

			if (!query) {
				return new Response('Search query parameter "q" is required', { status: 400 });
			}

			const limit = parseInt(url.searchParams.get('limit') || '20', 10);
			const offset = parseInt(url.searchParams.get('offset') || '0', 10);

			const posts = await this.env.threadClient!.searchPosts(query, id, limit, offset);
			const stats = await this.env.threadClient!.getSearchStats(query, id);

			return Response.json({
				results: posts,
				total: stats.count,
			});
		} catch (error: any) {
			console.error('Search error:', error);
			return new Response(
				JSON.stringify({
					success: false,
					error: error.message || 'An error occurred while searching',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	}

	@ApiOperation({
		path: '/api/search/suggestions',
		method: 'get',
		summary: 'Get search suggestions',
		description: 'Returns search suggestions as you type',
		tags: ['Search'],
		parameters: [
			{
				name: 'q',
				in: 'query',
				required: true,
				schema: {
					type: 'string',
				},
				description: 'Partial search query string',
			},
			{
				name: 'limit',
				in: 'query',
				required: false,
				schema: {
					type: 'integer',
					default: 5,
				},
				description: 'Maximum number of suggestions to return',
			},
		],
		responses: {
			'200': {
				description: 'Search suggestions',
				content: {
					'application/json': {
						schema: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									preview: { type: 'string' },
									thread_id: { type: 'integer' },
									thread_title: { type: 'string' },
									count: { type: 'integer' },
								},
							},
						},
					},
				},
			},
			'400': {
				description: 'Invalid request parameters',
			},
		},
	})
	@routeTrace
	async getSearchSuggestions(request: IRequest): Promise<Response> {
		try {
			const url = new URL(request.url);
			const query = url.searchParams.get('q');

			if (!query) {
				return new Response('Search query parameter "q" is required', { status: 400 });
			}

			const limit = parseInt(url.searchParams.get('limit') || '5', 10);

			const suggestions = await this.env.threadClient!.getSearchSuggestions(query, limit);

			return Response.json(suggestions);
		} catch (error: any) {
			console.error('Search suggestions error:', error);
			return new Response(
				JSON.stringify({
					success: false,
					error: error.message || 'An error occurred while getting search suggestions',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	}

	@ApiOperation({
		path: '/api/info',
		method: 'get',
		summary: 'Get system information',
		description: 'Returns comprehensive information about the system including version, status, and runtime details',
		tags: ['System'],
		responses: {
			'200': {
				description: 'System information',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								version: { type: 'string' },
								buildTimestamp: { type: 'string' },
								environment: { type: 'string' },
								status: { type: 'string' },
								uptime: { type: 'number' },
								database: {
									type: 'object',
									properties: {
										status: { type: 'string' },
										migrations: { type: 'string' },
									},
								},
								storage: {
									type: 'object',
									properties: {
										status: { type: 'string' },
									},
								},
								memory: {
									type: 'object',
									properties: {
										usage: { type: 'number' },
										available: { type: 'number' },
									},
								},
							},
						},
					},
				},
			},
		},
	})
	@routeTrace
	async getSystemInfo(request: IRequest): Promise<Response> {
		try {
			// Get build-related information
			const version = this.env.BUILD_HASH || '1.0.0';
			const buildTimestamp = this.env.BUILD_TIMESTAMP || new Date().toISOString();
			const environment = this.env.ENVIRONMENT || 'production';

			// Calculate uptime if available
			const startTime = this.env.START_TIME || Date.now();
			const uptime = Math.floor((Date.now() - Number(startTime)) / 1000); // Uptime in seconds

			// Check database status
			let dbStatus = 'unknown';
			let migrationVersion = 'unknown';

			// Check R2 storage status
			let storageStatus = 'unknown';
			try {
				if (this.env.BUCKET1) {
					// Try to list a single object to check connectivity
					await this.env.BUCKET1.list({ limit: 1 });
					storageStatus = 'connected';
				} else {
					storageStatus = 'not_configured';
				}
			} catch (storageError) {
				console.error('[TRACE] Storage check error:', storageError);
				storageStatus = 'error';
			}

			// Get memory information if available in Workers environment
			// Note: This is a placeholder as Workers doesn't expose memory info directly
			const memoryInfo = {
				usage: -1, // Not available in standard Workers
				available: -1, // Not available in standard Workers
			};

			// Get thread and post counts
			let totalThreads = 0;
			let totalPosts = 0;
			let totalDocuments = 0;

			try {
				const threadCountResult = await this.env.DB.prepare('SELECT COUNT(*) as count FROM threads').first();
				if (threadCountResult) {
					totalThreads = threadCountResult.count;
				}

				const postCountResult = await this.env.DB.prepare('SELECT COUNT(*) as count FROM posts').first();
				if (postCountResult) {
					totalPosts = postCountResult.count;
				}

				const documentCountResult = await this.env.DB.prepare('SELECT COUNT(*) as count FROM documents').first();
				if (documentCountResult) {
					totalDocuments = documentCountResult.count;
				}
			} catch (countError) {
				console.error('[TRACE] Count retrieval error:', countError);
			}

			// Assemble the response
			const systemInfo = {
				version,
				buildTimestamp,
				environment,
				status: 'operational', // Assuming we've reached this point, the API is operational
				uptime,
				database: {
					status: dbStatus,
					migrations: migrationVersion,
				},
				storage: {
					status: storageStatus,
				},
				memory: memoryInfo,
				stats: {
					threads: totalThreads,
					posts: totalPosts,
					documents: totalDocuments,
				},
				features: {
					webhooks: true,
					apiKeys: true,
					documentSupport: true,
					fileUploads: this.env.BUCKET1 ? true : false,
				},
			};

			return Response.json(systemInfo);
		} catch (error) {
			console.error('[TRACE] Error in getSystemInfo:', error);
			return Response.json(
				{
					status: 'error',
					message: 'Error retrieving system information',
					version: this.env.BUILD_HASH || '1.0.0',
				},
				{ status: 500 }
			);
		}
	}
}

// Main fetch handler
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (!(env.DB as any)._isTraced) {
			const tracedDB = createTracingD1Database(env.DB);
			env.DB = Object.assign(env.DB, tracedDB);
			(env.DB as any)._isTraced = true;
		}
		if (!env.threadClient) {
			env.threadClient = await D1ThreadClient.initialize(env.DB, env.BUCKET1);
		}
		const router = buildRouter(env);
		return router.fetch(request, env);
	},
} satisfies ExportedHandler<Env>;

/**
 * Build the router and register all routes.
 */
function buildRouter(env: Env): RouterType {
	const router = Router();
	const apiRoutes = new ApiRoutes(env);

	// Add OpenAPI spec endpoint (no auth required)
	router.get('/api/docs/openapi.json', apiRoutes.getOpenApiSpec.bind(apiRoutes));

	// Add system info endpoint (no auth required)
	router.get('/api/info', apiRoutes.getSystemInfo.bind(apiRoutes));

	// Apply auth middleware to routes starting with /api/*
	router.all('/api/*', async (request: Request, env: Env) => {
		// avoid auth for uploads and docs
		if (request.url.includes('/api/uploads/') || request.url.includes('/api/docs/')) {
			return;
		}

		const authResponse = await apiRoutes.middleware.auth(request);
		if (authResponse instanceof Response) {
			return authResponse;
		}
	});

	// Register API routes.
	router.get('/api/threads', apiRoutes.getThreads.bind(apiRoutes));
	router.get('/api/threads/:threadId', apiRoutes.getThreadById.bind(apiRoutes));
	router.get('/api/threads/latest/:threadId/:limit/:lastPostTime', apiRoutes.getLatestPosts.bind(apiRoutes));
	router.post('/api/threads', apiRoutes.createThread.bind(apiRoutes));
	router.delete('/api/threads/:threadId', apiRoutes.deleteThread.bind(apiRoutes));
	router.put('/api/threads/:threadId', apiRoutes.updateThread.bind(apiRoutes));
	router.post('/api/threads/:threadId/posts', apiRoutes.createUserPost.bind(apiRoutes));
	router.post('/api/system/threads/:threadId/posts', apiRoutes.createSystemPost.bind(apiRoutes));
	router.get('/api/threads/:threadId/posts', apiRoutes.getPosts.bind(apiRoutes));
	router.get('/api/threads/:threadId/documents', apiRoutes.getDocuments.bind(apiRoutes));
	router.post('/api/documents', apiRoutes.createDocument.bind(apiRoutes));
	router.get('/api/documents/:docId', apiRoutes.getDocument.bind(apiRoutes));
	router.delete('/api/documents/:docId', apiRoutes.deleteDocument.bind(apiRoutes));
	router.put('/api/documents/:docId', apiRoutes.updateDocument.bind(apiRoutes));
	router.get('/api/threads/:threadId/webhooks', apiRoutes.getWebhooks.bind(apiRoutes));
	router.post('/api/threads/:threadId/webhooks', apiRoutes.addWebhook.bind(apiRoutes));
	router.delete('/api/webhooks/:webhookId', apiRoutes.deleteWebhook.bind(apiRoutes));
	router.get('/api/posts/:postId', apiRoutes.getPost.bind(apiRoutes));
	router.put('/api/posts/:postId', apiRoutes.updatePost.bind(apiRoutes));
	router.delete('/api/posts/:postId', apiRoutes.deletePost.bind(apiRoutes));
	router.get('/api/thread/:threadId/apikeys', apiRoutes.getApiKeys.bind(apiRoutes));
	router.post('/api/thread/:threadId/apikeys', apiRoutes.addApiKey.bind(apiRoutes));
	router.delete('/api/apikeys/:apiKey', apiRoutes.deleteApiKey.bind(apiRoutes));
	router.put('/api/apikeys/:keyId', apiRoutes.updateApiKey.bind(apiRoutes));
	router.get('/api/uploads/:fileId', apiRoutes.getFile.bind(apiRoutes));
	router.post('/api/upload', apiRoutes.uploadFile.bind(apiRoutes));
	router.get('/version', () => {
		// read from env variable
		const version = env.BUILD_HASH || '1.0.0';
		console.log('Version:', version);
		return new Response(version);
	});
	router.get('/api/search', apiRoutes.searchAllPosts.bind(apiRoutes));
	router.get('/api/threads/:threadId/search', apiRoutes.searchThreadPosts.bind(apiRoutes));
	router.get('/api/search/suggestions', apiRoutes.getSearchSuggestions.bind(apiRoutes));
	router.all('*', () => new Response('Not Found', { status: 404 }));

	return router;
}
