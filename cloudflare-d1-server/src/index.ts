import { Router, RouterType } from 'itty-router';
import { D1ThreadClient } from '../../thread-again/app/clients/d1';
import type { ThreadCreateData, PostCreateData } from '../../thread-again/app/clients/types';

export interface Env {
	DB: D1Database;
	router?: RouterType;
	threadClient?: D1ThreadClient;
	API_KEY: string;
}

// Authentication middleware
const authMiddleware = (request: Request, env: Env) => {
	const authHeader = request.headers.get('Authorization');

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return new Response('Missing API key', { status: 401 });
	}

	const apiKey = authHeader.split('Bearer ')[1];
	if (apiKey !== env.API_KEY) {
		return new Response('Invalid API key', { status: 403 });
	}
};

// Main fetch handler
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Initialize our thread client on first request.
		if (!env.threadClient) {
			env.threadClient = await D1ThreadClient.initialize(env.DB);
		}
		if (!env.router) {
			env.router = buildRouter(env);
		}
		return env.router.fetch(request, env);
	},
} satisfies ExportedHandler<Env>;

// Build our API router with endpoints similar to our FastAPI server.
function buildRouter(env: Env): RouterType {
	const router = Router();

	// Add middleware to protect specific routes
	router.all('/api/*', (request: Request, env: Env) => {
		return authMiddleware(request, env);
	});

	// GET /api/threads — list threads
	router.get('/api/threads', async (request: Request, env: Env) => {
		try {
			const threads = await env.threadClient!.getThreads();
			return Response.json(threads);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// GET /api/threads/:threadId — get thread (with posts and documents)
	router.get('/api/threads/:threadId', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		const thread = await env.threadClient!.getThread(id);
		if (!thread) {
			return new Response('Thread not found', { status: 404 });
		}
		return Response.json(thread);
	});

	// POST /api/threads — create a thread with an initial post.
	router.post('/api/threads', async (request: Request, env: Env) => {
		try {
			const data = await request.formData();
			const image = data.get('image') as File | undefined;
			const threadData: ThreadCreateData = {
				title: data.get('title') as string,
				creator: data.get('creator') as string,
				initial_post: data.get('initial_post') as string,
				image: image,
			};
			const thread = await env.threadClient!.createThread(threadData);
			return Response.json(thread);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// DELETE /api/threads/:threadId — delete a thread
	router.delete('/api/threads/:threadId', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			await env.threadClient!.deleteThread(id);
			return Response.json({ message: 'Thread deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// POST /api/threads/:threadId/posts — create a user post
	router.post('/api/threads/:threadId/posts', async (request: Request, env: Env) => {
		const { threadId } = request.params;
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
			const post = await env.threadClient!.createPost(id, postData, 'user');

			// Notify all webhooks
			const webhooks = await env.threadClient!.getThreadWebhooks(id);
			for (const webhook of webhooks) {
				try {
					const headers: HeadersInit = {
						'Content-Type': 'application/json',
					};
					if (webhook.api_key) {
						headers['Authorization'] = `Bearer ${webhook.api_key}`;
					}

					await fetch(webhook.url, {
						method: 'POST',
						headers,
						body: JSON.stringify({
							event: 'post.created',
							thread_id: id,
							post: post,
						}),
					});

					await env.threadClient!.updateWebhookLastTriggered(webhook.id);
				} catch (error) {
					console.error(`Failed to notify webhook ${webhook.id}:`, error);
				}
			}

			return Response.json(post);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// POST /api/system/threads/:threadId/posts — create a system post
	router.post('/api/system/threads/:threadId/posts', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = await request.json();
			const post = await env.threadClient!.createPost(id, data, 'system');

			// Notify all webhooks
			const webhooks = await env.threadClient!.getThreadWebhooks(id);
			for (const webhook of webhooks) {
				try {
					const headers: HeadersInit = {
						'Content-Type': 'application/json',
					};
					if (webhook.api_key) {
						headers['Authorization'] = `Bearer ${webhook.api_key}`;
					}

					await fetch(webhook.url, {
						method: 'POST',
						headers,
						body: JSON.stringify({
							event: 'post.created',
							thread_id: id,
							post: post,
						}),
					});

					await env.threadClient!.updateWebhookLastTriggered(webhook.id);
				} catch (error) {
					console.error(`Failed to notify webhook ${webhook.id}:`, error);
				}
			}

			return Response.json(post);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// GET /api/threads/:threadId/posts — list posts for a thread
	router.get('/api/threads/:threadId/posts', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const posts = await env.threadClient!.getPosts(id);
			return Response.json(posts);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// GET /api/threads/:threadId/documents — list documents for a thread
	router.get('/api/threads/:threadId/documents', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const documents = await env.threadClient!.getThreadDocuments(id);
			return Response.json(documents);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// POST /api/documents — create a document
	router.post('/api/documents', async (request: Request, env: Env) => {
		try {
			const data = await request.json();
			const document = await env.threadClient!.createDocument(data.thread_id, {
				id: crypto.randomUUID(),
				title: data.title,
				content: data.content,
				type: data.type,
			});
			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// GET /api/documents/:docId — get a document
	router.get('/api/documents/:docId', async (request: Request, env: Env) => {
		const { docId } = request.params;
		try {
			const document = await env.threadClient!.getDocument(docId);
			if (!document) {
				return new Response('Document not found', { status: 404 });
			}
			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// DELETE /api/documents/:docId — delete a document
	router.delete('/api/documents/:docId', async (request: Request, env: Env) => {
		const { docId } = request.params;
		try {
			await env.threadClient!.deleteDocument(docId);
			return Response.json({ message: 'Document deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// PUT /api/documents/:docId — update a document
	router.put('/api/documents/:docId', async (request: Request, env: Env) => {
		try {
			const { docId } = request.params;
			const data = await request.json();
			const document = await env.threadClient!.updateDocument(docId, {
				title: data.title,
				content: data.content,
				type: data.type,
			});
			return Response.json(document);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// GET /api/threads/:threadId/webhooks — list webhooks for a thread
	router.get('/api/threads/:threadId/webhooks', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const webhooks = await env.threadClient!.getThreadWebhooks(id);
			return Response.json(webhooks);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// POST /api/threads/:threadId/webhooks — add a webhook to a thread
	router.post('/api/threads/:threadId/webhooks', async (request: Request, env: Env) => {
		const { threadId } = request.params;
		const id = Number(threadId);
		if (isNaN(id)) {
			return new Response('Invalid thread ID', { status: 400 });
		}
		try {
			const data = await request.json();
			await env.threadClient!.addWebhook(id, data.url, data.api_key);
			const webhooks = await env.threadClient!.getThreadWebhooks(id);
			return Response.json(webhooks[webhooks.length - 1]);
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// DELETE /api/webhooks/:webhookId — delete a webhook
	router.delete('/api/webhooks/:webhookId', async (request: Request, env: Env) => {
		const { webhookId } = request.params;
		const id = Number(webhookId);
		if (isNaN(id)) {
			return new Response('Invalid webhook ID', { status: 400 });
		}
		try {
			await env.threadClient!.removeWebhook(id);
			return Response.json({ message: 'Webhook deleted' });
		} catch (e: any) {
			return new Response(e.message, { status: 500 });
		}
	});

	// GET /api/posts/:postId — get a post
	router.get('/api/posts/:postId', async (request: Request, env: Env) => {
		const { postId } = request.params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		const stmt = env.DB.prepare('SELECT * FROM posts WHERE id = ?');
		const post = await stmt.bind(id).first();
		if (!post) {
			return new Response('Post not found', { status: 404 });
		}
		await env.DB.prepare("UPDATE posts SET view_count = view_count + 1, seen = 1, last_viewed = datetime('now') WHERE id = ?")
			.bind(id)
			.run();
		const updated = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
		return Response.json(updated);
	});

	// PUT /api/posts/:postId — update a post
	router.put('/api/posts/:postId', async (request: Request, env: Env) => {
		const { postId } = request.params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		const data = await request.json();
		const stmt = env.DB.prepare('UPDATE posts SET text = ?, image = ?, edited = 1 WHERE id = ?');
		const result = await stmt.bind(data.text, data.image || null, id).run();
		if (!result.success) {
			return new Response('Post update failed', { status: 500 });
		}
		const updated = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
		return Response.json(updated);
	});

	// DELETE /api/posts/:postId — delete a post
	router.delete('/api/posts/:postId', async (request: Request, env: Env) => {
		const { postId } = request.params;
		const id = Number(postId);
		if (isNaN(id)) {
			return new Response('Invalid post ID', { status: 400 });
		}
		await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
		return Response.json({ message: 'Post deleted' });
	});

	// POST /api/upload — file upload (not implemented here)
	router.post('/api/upload', async (request: Request, env: Env) => {
		return new Response('File upload not implemented', { status: 501 });
	});

	// Catch-all for unmatched routes
	router.all('*', () => new Response('Not Found', { status: 404 }));

	return router;
}
