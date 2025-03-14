import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import {
  ThreadClient,
  Thread,
  ThreadCreateData,
  Post,
  PostCreateData,
  Document,
} from "./types";

/**
 * SqliteThreadClient implements ThreadClient using a local SQLite database.
 */
export class SqliteThreadClient extends ThreadClient {
  private db: Database;

  // Private constructor; use the static initialize() method to create an instance.
  private constructor(db: Database) {
    super();
    this.db = db;
  }

  /**
   * Initialize a new instance.
   * Ensures that the necessary tables exist.
   */
  static async initialize(dbPath: string): Promise<SqliteThreadClient> {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    await SqliteThreadClient.createTables(db);
    return new SqliteThreadClient(db);
  }

  /**
   * Create tables if they do not exist.
   */
  private static async createTables(db: Database): Promise<void> {
    // Create threads table.
    await db.exec(`
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
    `);
    // Create posts table.
    await db.exec(`
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
    `);
    // Create documents table.
    await db.exec(`
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
    `);
    // Create webhooks table.
    await db.exec(`
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
    `);
  }

  /**
   * Retrieve all threads (ordered by latest activity).
   */
  async getThreads(): Promise<Thread[]> {
    const threads = await this.db.all<Thread[]>(`
      SELECT * FROM threads ORDER BY last_activity DESC
    `);
    return threads;
  }

  /**
   * Retrieve a single thread and its associated posts/documents.
   * (Also increments the thread's view_count.)
   */
  async getThread(threadId: number): Promise<Thread | null> {
    const thread = await this.db.get<Thread>(
      `SELECT * FROM threads WHERE id = ?`,
      threadId
    );
    if (!thread) return null;

    // Increase the view count.
    await this.db.run(
      `UPDATE threads SET view_count = view_count + 1 WHERE id = ?`,
      threadId
    );

    // Optionally load posts and documents.
    const posts = await this.getPosts(threadId);
    const documents = await this.db.all<Document[]>(
      `SELECT * FROM documents WHERE thread_id = ?`,
      threadId
    );
    return { ...thread, posts, documents };
  }

  /**
   * Create a new thread.
   * Automatically creates an initial post using the provided data.
   */
  async createThread(data: ThreadCreateData): Promise<Thread> {
    const result = await this.db.run(
      `INSERT INTO threads (title, creator) VALUES (?, ?)`,
      data.title,
      data.creator
    );
    const threadId = result.lastID;

    if (!threadId) {
      throw new Error("Error creating thread");
    }

    // Create the initial post.
    await this.createPost(
      threadId,
      { text: data.initial_post, image: data.image },
      data.creator
    );
    // Return the created thread.
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error("Error creating thread");
    }
    return thread;
  }

  /**
   * Delete a thread (and its related posts/documents/webhooks via cascade).
   */
  async deleteThread(threadId: number): Promise<void> {
    await this.db.run(`DELETE FROM threads WHERE id = ?`, threadId);
  }

  /**
   * Create a post in a thread.
   * Optionally accepts an author (defaulting to 'user').
   */
  async createPost(
    threadId: number,
    data: PostCreateData,
    author: string = "user"
  ): Promise<Post> {
    // Verify that the thread exists.
    const thread = await this.db.get(
      `SELECT * FROM threads WHERE id = ?`,
      threadId
    );
    if (!thread) {
      throw new Error("Thread not found");
    }
    const result = await this.db.run(
      `INSERT INTO posts (thread_id, author, text, image, is_initial_post)
       VALUES (?, ?, ?, ?, ?)`,
      threadId,
      author,
      data.text,
      data.image || null,
      0 // default is_initial_post flag is false
    );
    // Update the thread's reply count and last activity.
    await this.db.run(
      `UPDATE threads SET reply_count = reply_count + 1, last_activity = datetime('now') WHERE id = ?`,
      threadId
    );
    const postId = result.lastID;
    const post = await this.db.get<Post>(
      `SELECT * FROM posts WHERE id = ?`,
      postId
    );
    if (!post) {
      throw new Error("Error creating post");
    }
    return post;
  }

  /**
   * Retrieve all posts for a given thread.
   */
  async getPosts(threadId: number): Promise<Post[]> {
    return await this.db.all<Post[]>(
      `SELECT * FROM posts WHERE thread_id = ? ORDER BY time`,
      threadId
    );
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
    const thread = await this.db.get(
      `SELECT * FROM threads WHERE id = ?`,
      threadId
    );
    if (!thread) {
      throw new Error("Thread not found");
    }

    await this.db.run(
      `INSERT INTO documents (id, thread_id, title, content, type)
       VALUES (?, ?, ?, ?, ?)`,
      data.id,
      threadId,
      data.title,
      data.content,
      data.type
    );

    const document = await this.getDocument(data.id);
    if (!document) {
      throw new Error("Error creating document");
    }
    return document;
  }

  /**
   * Retrieve a document by its ID.
   * Increments the document's view count.
   */
  async getDocument(documentId: string): Promise<Document | null> {
    const document = await this.db.get<Document>(
      `SELECT * FROM documents WHERE id = ?`,
      documentId
    );
    if (!document) return null;

    // Update view count and last viewed timestamp
    await this.db.run(
      `UPDATE documents
       SET view_count = view_count + 1,
           last_viewed = datetime('now')
       WHERE id = ?`,
      documentId
    );

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

    await this.db.run(
      `UPDATE documents
       SET ${updates.join(", ")}
       WHERE id = ?`,
      ...values
    );

    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error("Error updating document");
    }
    return document;
  }

  /**
   * Delete a document.
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.db.run(`DELETE FROM documents WHERE id = ?`, documentId);
  }

  /**
   * Get all documents for a thread.
   */
  async getThreadDocuments(threadId: number): Promise<Document[]> {
    return await this.db.all<Document[]>(
      `SELECT * FROM documents WHERE thread_id = ? ORDER BY created_at`,
      threadId
    );
  }

  /**
   * Add a webhook for a thread.
   */
  async addWebhook(
    threadId: number,
    url: string,
    apiKey?: string
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO webhooks (thread_id, url, api_key)
       VALUES (?, ?, ?)`,
      threadId,
      url,
      apiKey || null
    );
  }

  /**
   * Remove a webhook from a thread.
   */
  async removeWebhook(webhookId: number): Promise<void> {
    await this.db.run(`DELETE FROM webhooks WHERE id = ?`, webhookId);
  }

  /**
   * Get all webhooks for a thread.
   */
  async getThreadWebhooks(threadId: number): Promise<any[]> {
    return await this.db.all(
      `SELECT * FROM webhooks WHERE thread_id = ? ORDER BY created_at`,
      threadId
    );
  }

  /**
   * Update a webhook's last triggered timestamp.
   */
  async updateWebhookLastTriggered(webhookId: number): Promise<void> {
    await this.db.run(
      `UPDATE webhooks
       SET last_triggered = datetime('now')
       WHERE id = ?`,
      webhookId
    );
  }
}
