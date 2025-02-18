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
   * Creates the necessary tables (threads, posts, documents).
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
   * Delete a thread (its posts and documents will be removed via cascade).
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

  // TODO: add document-related methods following the same pattern.
}
