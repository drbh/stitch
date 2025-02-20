import {
  ThreadClient,
  Thread,
  ThreadCreateData,
  Post,
  PostCreateData,
  Document,
} from "./types";

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
        reply_count INTEGER DEFAULT 0
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
        id TEXT PRIMARY KEY,
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
    const docsStmt = this.d1.prepare(
      "SELECT * FROM documents WHERE thread_id = ?"
    );
    const docsResult = await docsStmt.bind(threadId).all();
    const documents = (docsResult.results as Document[]) || [];

    return { ...thread, posts, documents };
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
   * Add a webhook for a thread.
   */
  async addWebhook(
    threadId: number,
    url: string,
    apiKey?: string
  ): Promise<void> {
    const stmt = this.d1.prepare(`
      INSERT INTO webhooks (thread_id, url, api_key)
      VALUES (?, ?, ?)
    `);
    await stmt.bind(threadId, url, apiKey || null).run();
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
  async createDocument(
    threadId: number,
    data: {
      id: string;
      title: string;
      content: string;
      type: string;
    }
  ): Promise<Document> {
    // Verify the thread exists
    const threadStmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = await threadStmt.bind(threadId).first();
    if (!thread) {
      throw new Error("Thread not found");
    }

    const stmt = this.d1.prepare(`
      INSERT INTO documents (id, thread_id, title, content, type)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await stmt
      .bind(data.id, threadId, data.title, data.content, data.type)
      .run();

    if (!result.success) {
      throw new Error("Document creation failed");
    }

    const document = await this.getDocument(data.id);
    if (!document) {
      throw new Error("Error retrieving document after creation");
    }
    return document;
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
}
