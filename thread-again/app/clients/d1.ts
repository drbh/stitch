import {
  ThreadClient,
  Thread,
  ThreadCreateData,
  Post,
  PostCreateData,
  Document,
  APIKey,
  Webhook,
} from "../clients/types";

/**
 * A minimal D1 Database interface. In your Cloudflare Worker,
 * the D1 binding (e.g. `env.DB`) will provide these methods.
 */
interface D1Result {
  results?: any[];
  lastRowId?: number;
  success: boolean;
  meta: {
    last_row_id: number;
  };
}
interface D1PreparedStatement {
  bind(...params: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all(): Promise<D1Result>;
  first(): Promise<any | undefined>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/**
 * D1ThreadClient implements ThreadClient using Cloudflare's D1.
 */
export class D1ThreadClient extends ThreadClient {
  private d1: D1Database;

  // Private constructor; use the static initialize() method to create an instance.
  private constructor(d1: D1Database) {
    super();
    this.d1 = d1;
  }

  /**
   * Initializes the client and creates tables if they do not exist.
   * (Schema migrations are usually handled separately in production.)
   */
  static async initialize(d1: D1Database): Promise<D1ThreadClient> {
    const client = new D1ThreadClient(d1);
    await client.createTables();
    return client;
  }

  /**
   * Creates the necessary tables (threads, posts, documents, webhooks).
   */
  private async createTables(): Promise<void> {
    await this.d1
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_activity TEXT DEFAULT (datetime('now')),
        creator TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        share_pubkey TEXT DEFAULT NULL
      );
    `
      )
      .run();

    await this.d1
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        time TEXT DEFAULT (datetime('now')),
        image TEXT,
        edited INTEGER DEFAULT 0,
        seen INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        last_viewed TEXT,
        is_initial_post INTEGER DEFAULT 0,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      );
    `
      )
      .run();

    await this.d1
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_viewed TEXT,
        view_count INTEGER DEFAULT 0,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      );
    `
      )
      .run();

    await this.d1
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        api_key TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_triggered TEXT,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      );
    `
      )
      .run();

    await this.d1
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        key_name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        permissions TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      );
    `
      )
      .run();
  }

  /**
   * Retrieve all threads (ordered by last activity).
   */
  async getThreads(): Promise<Thread[]> {
    const stmt = this.d1.prepare(
      "SELECT * FROM threads ORDER BY last_activity DESC"
    );
    const result = await stmt.all();
    return (result.results as Thread[]) || [];
  }

  /**
   * Retrieve a thread (with its posts and documents) by its ID.
   * Increments the thread's view count.
   */
  async getThread(threadId: number): Promise<Thread | null> {
    const stmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = (await stmt.bind(threadId).first()) as Thread | undefined;
    if (!thread) return null;

    // Increase view count.
    await this.d1
      .prepare("UPDATE threads SET view_count = view_count + 1 WHERE id = ?")
      .bind(threadId)
      .run();

    const posts = await this.getPosts(threadId);
    return { ...thread, posts };
  }

  /**
   * Create a new thread and an initial post.
   */
  async createThread(data: ThreadCreateData): Promise<Thread> {
    const stmt = this.d1.prepare(
      "INSERT INTO threads (title, creator) VALUES (?, ?)"
    );
    const result = await stmt.bind(data.title, data.creator).run();

    if (!result.success) {
      throw new Error("Thread creation failed");
    }

    const threadId = result.meta.last_row_id;
    if (threadId === null || threadId === undefined) {
      throw new Error("Thread creation failed");
    }

    // Create the initial post.
    await this.createPost(
      threadId,
      { text: data.initial_post, image: data.image },
      data.creator
    );

    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error("Error retrieving thread after creation");
    }
    return thread;
  }

  /**
   * Delete a thread (its posts, documents, and webhooks will be removed via cascade).
   */
  async deleteThread(threadId: number): Promise<void> {
    await this.d1
      .prepare("DELETE FROM threads WHERE id = ?")
      .bind(threadId)
      .run();
  }

  /**
   * Update an existing thread.
   */
  async updateThread(
    threadId: number,
    data: {
      title?: string;
      sharePubkey?: string;
    }
  ): Promise<Thread> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      values.push(data.title);
    }
    if (data.sharePubkey !== undefined) {
      updates.push("share_pubkey = ?");
      values.push(data.sharePubkey);
    }

    if (updates.length === 0) {
      throw new Error("No updates provided");
    }

    updates.push("updated_at = datetime('now')");
    values.push(threadId);

    const stmt = this.d1.prepare(`
      UPDATE threads
      SET ${updates.join(", ")}
      WHERE id = ?
    `);
    const result = await stmt.bind(...values).run();

    if (!result.success) {
      throw new Error("Thread update failed");
    }

    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error("Error retrieving thread after update");
    }
    return thread;
  }

  /**
   * Create a post in a thread.
   */
  async createPost(
    threadId: number,
    data: PostCreateData,
    author: string = "user"
  ): Promise<Post> {
    // Verify the thread exists.
    const threadStmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = await threadStmt.bind(threadId).first();
    if (!thread) {
      throw new Error("Thread not found");
    }

    const stmt = this.d1.prepare(`
      INSERT INTO posts (thread_id, author, text, image, is_initial_post)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await stmt
      .bind(threadId, author, data.text, data.image || null, 0)
      .run();

    // Update the thread's reply count and last activity.
    await this.d1
      .prepare(
        "UPDATE threads SET reply_count = reply_count + 1, last_activity = datetime('now') WHERE id = ?"
      )
      .bind(threadId)
      .run();

    if (!result.success) {
      throw new Error("Post creation failed");
    }

    const postId = result.meta.last_row_id;
    if (postId === null || postId === undefined) {
      throw new Error("Post creation failed");
    }

    const post = await this.d1
      .prepare("SELECT * FROM posts WHERE id = ?")
      .bind(postId)
      .first();
    return post as Post;
  }

  /**
   * Retrieve all posts for a given thread (ordered by time).
   */
  async getPosts(threadId: number): Promise<Post[]> {
    const stmt = this.d1.prepare(
      "SELECT * FROM posts WHERE thread_id = ? ORDER BY time"
    );
    const result = await stmt.bind(threadId).all();
    return (result.results as Post[]) || [];
  }

  /**
   * Update a post's view sount, seen status, and last viewed timestamp.
   */
  async updatePostView(postId: number): Promise<void> {
    await this.d1
      .prepare(
        "UPDATE posts SET view_count = view_count + 1, seen = 1, last_viewed = datetime('now') WHERE id = ?"
      )
      .bind(postId)
      .run();
  }

  /**
   * Retrieve a post by its ID.
   */
  async getPost(postId: number): Promise<Post> {
    const stmt = this.d1.prepare("SELECT * FROM posts WHERE id = ?");
    const post = (await stmt.bind(postId).first()) as Post | undefined;
    if (!post) {
      throw new Error("Post not found");
    }
    return post;
  }

  /**
   * Update an existing post.
   */
  async updatePost(
    postId: number,
    data: { text: string; image?: File }
  ): Promise<Post> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.text !== undefined) {
      updates.push("text = ?");
      values.push(data.text);
    }
    if (data.image !== undefined) {
      updates.push("image = ?");
      values.push(data.image);
    }

    if (updates.length === 0) {
      throw new Error("No updates provided");
    }

    updates.push("edited = 1");
    updates.push("time = datetime('now')");
    values.push(postId);

    const stmt = this.d1.prepare(`
      UPDATE posts
      SET ${updates.join(", ")}
      WHERE id = ?
    `);
    const result = await stmt.bind(...values).run();

    if (!result.success) {
      throw new Error("Post update failed");
    }

    const post = await this.getPost(postId);
    return post;
  }

  /**
   * Delete a post.
   */
  async deletePost(postId: number): Promise<void> {
    await this.d1.prepare("DELETE FROM posts WHERE id = ?").bind(postId).run();
  }

  /**
   * Add a webhook for a thread.
   */
  async addWebhook(
    threadId: number,
    url: string,
    apiKey?: string
  ): Promise<Webhook> {
    const stmt = this.d1.prepare(`
      INSERT INTO webhooks (thread_id, url, api_key)
      VALUES (?, ?, ?)
    `);
    const result = await stmt.bind(threadId, url, apiKey || null).run();

    if (!result.success) {
      throw new Error("Webhook creation failed");
    }

    const webhookId = result.meta.last_row_id;

    const webhook = await this.d1
      .prepare("SELECT * FROM webhooks WHERE id = ?")
      .bind(webhookId)
      .first();

    return webhook as Webhook;
  }

  /**
   * Remove a webhook from a thread.
   */
  async removeWebhook(webhookId: number): Promise<void> {
    await this.d1
      .prepare("DELETE FROM webhooks WHERE id = ?")
      .bind(webhookId)
      .run();
  }

  /**
   * Get all webhooks for a thread.
   */
  async getThreadWebhooks(threadId: number): Promise<any[]> {
    const stmt = this.d1.prepare(
      "SELECT * FROM webhooks WHERE thread_id = ? ORDER BY created_at"
    );
    const result = await stmt.bind(threadId).all();
    return result.results || [];
  }

  /**
   * Update a webhook's last triggered timestamp.
   */
  async updateWebhookLastTriggered(webhookId: number): Promise<void> {
    await this.d1
      .prepare(
        "UPDATE webhooks SET last_triggered = datetime('now') WHERE id = ?"
      )
      .bind(webhookId)
      .run();
  }

  /**
   * Create a new document in a thread.
   */
  async createDocument(threadId: number, data: Document): Promise<Document> {
    // Verify the thread exists
    const threadStmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = await threadStmt.bind(threadId).first();
    if (!thread) {
      throw new Error("Thread not found");
    }

    const stmt = this.d1.prepare(`
      INSERT INTO documents (thread_id, title, content, type)
      VALUES (?, ?, ?, ?)
    `);
    const result = await stmt
      .bind(threadId, data.title, data.content, data.type)
      .run();

    if (!result.success) {
      throw new Error("Document creation failed");
    }
    const docId = result.meta.last_row_id;

    const document = await this.d1
      .prepare("SELECT * FROM documents WHERE id = ?")
      .bind(docId)
      .first();

    return document as Document;
  }

  /**
   * Retrieve a document by its ID.
   * Increments the document's view count.
   */
  async getDocument(documentId: string): Promise<Document | null> {
    const stmt = this.d1.prepare("SELECT * FROM documents WHERE id = ?");
    const document = (await stmt.bind(documentId).first()) as
      | Document
      | undefined;
    if (!document) return null;

    // Update view count and last viewed timestamp
    await this.d1
      .prepare(
        "UPDATE documents SET view_count = view_count + 1, last_viewed = datetime('now') WHERE id = ?"
      )
      .bind(documentId)
      .run();

    return document;
  }

  /**
   * Update an existing document.
   */
  async updateDocument(
    documentId: string,
    data: {
      title?: string;
      content?: string;
      type?: string;
    }
  ): Promise<Document> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      values.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push("content = ?");
      values.push(data.content);
    }
    if (data.type !== undefined) {
      updates.push("type = ?");
      values.push(data.type);
    }

    if (updates.length === 0) {
      throw new Error("No updates provided");
    }

    updates.push("updated_at = datetime('now')");
    values.push(documentId);

    const stmt = this.d1.prepare(`
      UPDATE documents
      SET ${updates.join(", ")}
      WHERE id = ?
    `);
    const result = await stmt.bind(...values).run();

    if (!result.success) {
      throw new Error("Document update failed");
    }

    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error("Error retrieving document after update");
    }
    return document;
  }

  /**
   * Delete a document.
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.d1
      .prepare("DELETE FROM documents WHERE id = ?")
      .bind(documentId)
      .run();
  }

  /**
   * Get all documents for a thread.
   */
  async getThreadDocuments(threadId: number): Promise<Document[]> {
    const stmt = this.d1.prepare(
      "SELECT * FROM documents WHERE thread_id = ? ORDER BY created_at"
    );
    const result = await stmt.bind(threadId).all();
    return (result.results as Document[]) || [];
  }

  /**
   * Retrieve an API key by its key.
   */
  async getAPIKey(key: string): Promise<APIKey> {
    const stmt = this.d1.prepare("SELECT * FROM api_keys WHERE api_key = ?");
    const apiKey = (await stmt.bind(key).first()) as APIKey | undefined;
    if (!apiKey) {
      throw new Error("API key not found");
    }
    return apiKey;
  }

  /**
   * Retrieve an API key by its thread ID.
   */
  async getThreadApiKeys(threadId: number): Promise<APIKey[]> {
    const stmt = this.d1.prepare(
      "SELECT * FROM api_keys WHERE thread_id = ? ORDER BY created_at"
    );
    const result = await stmt.bind(threadId).all();
    return (result.results as APIKey[]) || [];
  }

  /**
   * Create a new API key for a thread.
   */
  async createAPIKey(
    threadId: number,
    keyName: string,
    permissions: any
  ): Promise<APIKey> {
    // Verify the thread exists
    const threadStmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = await threadStmt.bind(threadId).first();
    if (!thread) {
      throw new Error("Thread not found");
    }

    const stmt = this.d1.prepare(`
      INSERT INTO api_keys (thread_id, key_name, api_key, permissions)
      VALUES (?, ?, ?, ?)
    `);
    // const apiKey = Math.random().toString(36).substring(2);

    const apiKeyRaw = crypto.getRandomValues(new Uint8Array(20));
    const apiKey = Array.from(apiKeyRaw)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await stmt
      .bind(threadId, keyName, apiKey, JSON.stringify(permissions))
      .run();

    if (!result.success) {
      throw new Error("API key creation failed");
    }

    const keyId = result.meta.last_row_id;

    const key = await this.d1
      .prepare("SELECT * FROM api_keys WHERE id = ?")
      .bind(keyId)
      .first();

    return key as APIKey;
  }

  /**
   * Update an existing API key.
   */
  async updateAPIKey(key: string, permissions: any): Promise<APIKey> {
    const stmt = this.d1.prepare(`
      UPDATE api_keys
      SET permissions = ?
      WHERE api_key = ?
    `);
    const result = await stmt.bind(JSON.stringify(permissions), key).run();

    if (!result.success) {
      throw new Error("API key update failed");
    }

    const apiKey = await this.getAPIKey(key);
    if (!apiKey) {
      throw new Error("Error retrieving API key after update");
    }
    return apiKey;
  }

  /**
   * Delete an API key.
   */
  async deleteAPIKey(key: string): Promise<void> {
    await this.d1
      .prepare("DELETE FROM api_keys WHERE api_key = ?")
      .bind(key)
      .run();
  }
}
