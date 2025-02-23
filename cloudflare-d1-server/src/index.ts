import { Router, RouterType } from 'itty-router';
import { D1ThreadClient, createTracingD1Database } from '../../thread-again/app/clients/d1';
import type { ThreadCreateData, PostCreateData } from '../../thread-again/app/clients/types';

export interface Env {
	DB: D1Database;
	router?: RouterType;
	threadClient?: D1ThreadClient;
	API_KEY: string;
}

/**
 * Decorator for route tracing.
 * Logs method entry (with the request URL), exit (with duration), and errors.
 */
function routeTrace(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	const originalMethod = descriptor.value;
	descriptor.value = async function (...args: any[]) {
		const request = args[0] as Request;
		// console.log(`[TRACE] Entering ${propertyKey} with URL: ${request.url}`);
		const start = Date.now();
		try {
			const result = await originalMethod.apply(this, args);
			console.log(`[TRACE] Exiting ${propertyKey} in ${Date.now() - start}ms`);
			return result;
		} catch (error) {
			console.error(`[TRACE] Error in ${propertyKey}:`, error);
			throw error;
		}
	};
	return descriptor;
}

/**
 * Middleware class to handle authentication.
 */
class ApiMiddleware {
	constructor(private env: Env) {}

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
			if (apiKey !== this.env.API_KEY) {
				console.log('[TRACE] Invalid API key');
				return new Response('Invalid API key', { status: 403 });
			}
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

	@routeTrace
	async getThreads(request: Request): Promise<Response> {
		try {
			const threads = await this.env.threadClient!.getThreads();
			return Response.json(threads);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@routeTrace
	async getThreadById(request: Request): Promise<Response> {
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

	@routeTrace
	async createThread(request: Request): Promise<Response> {
		try {
			const data = await request.formData();
			const image = data.get('image') as File | undefined;
			const threadData: ThreadCreateData = {
				title: data.get('title') as string,
				creator: data.get('creator') as string,
				initial_post: data.get('initial_post') as string,
				image,
			};
			const thread = await this.env.threadClient!.createThread(threadData);
			return Response.json(thread);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@routeTrace
	async deleteThread(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			await this.env.threadClient!.deleteThread(id);
			return Response.json({ message: 'Thread deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

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
			return Response.json(thread);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@routeTrace
	async createUserPost(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = await request.formData();
			const postData: PostCreateData = {
				text: data.get('text') as string,
				image: data.get('image') as File | undefined,
			};
			const post = await this.env.threadClient!.createPost(id, postData, 'user');
			// Notify all webhooks
			const webhooks = await this.env.threadClient!.getThreadWebhooks(id);
			for (const webhook of webhooks) {
				try {
					const headers: HeadersInit = { 'Content-Type': 'application/json' };
					if (webhook.api_key) {
						headers['Authorization'] = `Bearer ${webhook.api_key}`;
					}
					await fetch(webhook.url, {
						method: 'POST',
						headers,
						body: JSON.stringify({
							event: 'post.created',
							thread_id: id,
							post,
						}),
					});
					await this.env.threadClient!.updateWebhookLastTriggered(webhook.id);
				} catch (error) {
					console.error(`[TRACE] Failed to notify webhook ${webhook.id}:`, error);
				}
			}
			return Response.json(post);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@routeTrace
	async createSystemPost(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = await request.json();
			const post = await this.env.threadClient!.createPost(id, data, 'system');
			// Notify all webhooks
			const webhooks = await this.env.threadClient!.getThreadWebhooks(id);
			for (const webhook of webhooks) {
				try {
					const headers: HeadersInit = { 'Content-Type': 'application/json' };
					if (webhook.api_key) {
						headers['Authorization'] = `Bearer ${webhook.api_key}`;
					}
					await fetch(webhook.url, {
						method: 'POST',
						headers,
						body: JSON.stringify({
							event: 'post.created',
							thread_id: id,
							post,
						}),
					});
					await this.env.threadClient!.updateWebhookLastTriggered(webhook.id);
				} catch (error) {
					console.error(`[TRACE] Failed to notify webhook ${webhook.id}:`, error);
				}
			}
			return Response.json(post);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

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

	@routeTrace
	async createDocument(request: Request): Promise<Response> {
		try {
			const data = await request.json();
			const document = await this.env.threadClient!.createDocument(data.thread_id, {
				title: data.title,
				content: data.content,
				type: data.type,
			});
			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

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

	@routeTrace
	async deleteDocument(request: Request): Promise<Response> {
		const { docId } = (request as any).params;
		try {
			await this.env.threadClient!.deleteDocument(docId);
			return Response.json({ message: 'Document deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

	@routeTrace
	async updateDocument(request: Request): Promise<Response> {
		try {
			const { docId } = (request as any).params;
			const data = await request.json();
			const document = await this.env.threadClient!.updateDocument(docId, {
				title: data.title,
				content: data.content,
				type: data.type,
			});
			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

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

	@routeTrace
	async addWebhook(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = await request.json();
			await this.env.threadClient!.addWebhook(id, data.url, data.api_key);
			const webhooks = await this.env.threadClient!.getThreadWebhooks(id);
			return Response.json(webhooks[webhooks.length - 1]);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	}

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

	@routeTrace
	async updatePost(request: Request): Promise<Response> {
		const { postId } = (request as any).params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		const data = await request.json();
		const post = await this.env.threadClient!.updatePost(id, data);
		if (!post) {
			return new Response('Post not found', { status: 404 });
		}
		return Response.json(post);
	}

	@routeTrace
	async deletePost(request: Request): Promise<Response> {
		const { postId } = (request as any).params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		await this.env.threadClient!.deletePost(id);
		return Response.json({ message: 'Post deleted' });
	}

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

	@routeTrace
	async addApiKey(request: Request): Promise<Response> {
		const { threadId } = (request as any).params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		const data = await request.json();
		const permissions = '[]';
		const randomKey = crypto.randomUUID();
		const randomKeyName = 'key_' + randomKey.split('-')[0];
		const key = await this.env.threadClient!.createAPIKey(id, randomKeyName, permissions);
		return Response.json(key);
	}

	@routeTrace
	async deleteApiKey(request: Request): Promise<Response> {
		const { apiKey } = (request as any).params;
		await this.env.threadClient!.deleteAPIKey(apiKey);
		return Response.json({ message: 'API key deleted' });
	}

	@routeTrace
	async updateApiKey(request: Request): Promise<Response> {
		const { apiKey } = (request as any).params;
		const data = await request.json();
		const updated = await this.env.threadClient!.updateAPIKey(apiKey, data.permissions);
		return Response.json(updated);
	}

	@routeTrace
	async uploadFile(request: Request): Promise<Response> {
		return new Response('File upload not implemented', { status: 501 });
	}
}

// Main fetch handler
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Optionally wrap the DB with tracing
		if (!(env.DB as any)._isTraced) {
			env.DB = createTracingD1Database(env.DB);
			(env.DB as any)._isTraced = true;
		}
		if (!env.threadClient) {
			env.threadClient = await D1ThreadClient.initialize(env.DB);
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

	// Apply auth middleware to routes starting with /api/*
	router.all('/api/*', async (request: Request, env: Env) => {
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
	router.put('/api/apikeys/:apiKey', apiRoutes.updateApiKey.bind(apiRoutes));
	router.post('/api/upload', apiRoutes.uploadFile.bind(apiRoutes));
	router.all('*', () => new Response('Not Found', { status: 404 }));

	return router;
}
