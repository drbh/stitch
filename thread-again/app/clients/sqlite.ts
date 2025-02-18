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
   * Delete a thread (and its related posts/documents via cascade).
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
    // Update the thread’s reply count and last activity.
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

  // TODO: implement document methods similarly:
  // async createDocument(data: DocumentCreateData): Promise<Document> { ... }
  // async getDocument(docId: string): Promise<Document | null> { ... }
  // async updateDocument(docId: string, data: DocumentCreateData): Promise<Document> { ... }
  // async deleteDocument(docId: string): Promise<void> { ... }
}
