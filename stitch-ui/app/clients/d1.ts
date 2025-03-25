import { R2Object, R2ObjectBody } from "@cloudflare/workers-types";
import { ThreadClient } from "./types";
import type {
  Thread,
  ThreadCreateData,
  Post,
  PostCreateData,
  Document,
  APIKey,
  Webhook,
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
export interface D1PreparedStatement {
  bind(...params: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all(): Promise<D1Result>;
  first(): Promise<any | undefined>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

const DEBUG = true;

/**
 * Wraps a D1Database instance with a Proxy that logs every method call.
 */
export function createTracingD1Database(d1: D1Database): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      const orig = target[prop as keyof D1Database];
      if (typeof orig === "function") {
        return function (...args: any[]) {
          // console.log(
          //   `[TRACE] d1.${String(prop)} called with arguments:`,
          //   args
          // );

          // @ts-ignore
          const result = orig.apply(target, args);
          if (result instanceof Promise) {
            result
              .then(
                (res) =>
                  // console.log(`[TRACE] d1.${String(prop)} resolved with:`, res)
                  1 + 1
              )
              .catch(
                (err) =>
                  // console.error(`[TRACE] d1.${String(prop)} rejected with:`, err)
                  1 + 1
              );
          } else {
            // console.log(`[TRACE] d1.${String(prop)} returned:`, result);
          }
          return result;
        };
      }
      return orig;
    },
  });
}

/**
 * Decorator for method-level tracing. Logs the method entry,
 * its arguments, and the exit result (or any error thrown).
 */
function traceMethod(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    // console.log(`[TRACE] Entering ${propertyKey} with arguments:`, args);
    try {
      const result = await originalMethod.apply(this, args);
      const end = Date.now();
      const duration = end - start;
      if (DEBUG) {
        console.log(`[TRACE] [${propertyKey}] returned in ${duration}ms`);
      }
      // console.log(`[TRACE] Exiting ${propertyKey} with result:`, result);
      return result;
    } catch (error) {
      console.error(`[TRACE] Error in ${propertyKey}:`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * D1ThreadClient implements ThreadClient using Cloudflare's D1.
 */
export class D1ThreadClient extends ThreadClient {
  private d1: D1Database;
  private bucket: any;

  // Private constructor; use the static initialize() method to create an instance.
  private constructor(d1: D1Database, bucket: any) {
    super();
    this.d1 = d1;
    this.bucket = bucket;
  }

  /**
   * Initializes the client and creates tables if they do not exist.
   * (Schema migrations are usually handled separately in production.)
   */
  @traceMethod
  static async initialize(
    d1: D1Database,
    bucket: any
  ): Promise<D1ThreadClient> {
    // Wrap the provided database with tracing.
    // const tracedD1 = createTracingD1Database(d1);
    const client = new D1ThreadClient(d1, bucket);
    // TODO: enable env config to avoid creating tables on startup
    // as in some cases we'll know that the tables are already created
    await client.createTables();
    return client;
  }

  /**
   * Creates the necessary tables (threads, posts, documents, webhooks).
   */
  @traceMethod
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

    // Create FTS5 virtual table for full-text search on posts
    await this.d1
      .prepare(
        `
      CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5 (
        text,
        author,
        thread_id UNINDEXED,
        content=posts,
        content_rowid=id
      );
    `
      )
      .run();

    // Create triggers to keep the FTS index in sync with the posts table
    await this.d1
      .prepare(
        `
      CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts
      BEGIN
        INSERT INTO posts_fts(rowid, text, author, thread_id)
        VALUES (new.id, new.text, new.author, new.thread_id);
      END;
    `
      )
      .run();

    await this.d1
      .prepare(
        `
      CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts
      BEGIN
        DELETE FROM posts_fts WHERE rowid = old.id;
      END;
    `
      )
      .run();

    await this.d1
      .prepare(
        `
      CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts
      BEGIN
        DELETE FROM posts_fts WHERE rowid = old.id;
        INSERT INTO posts_fts(rowid, text, author, thread_id)
        VALUES (new.id, new.text, new.author, new.thread_id);
      END;
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
  @traceMethod
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
  @traceMethod
  async getThread(threadId: number): Promise<Thread | null> {
    const stmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = (await stmt.bind(threadId).first()) as Thread | undefined;
    if (!thread) return null;

    // Increase view count.
    await this.d1
      .prepare("UPDATE threads SET view_count = view_count + 1 WHERE id = ?")
      .bind(threadId)
      .run();

    // sleep 1 second
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    // const posts = await this.getPosts(threadId);
    const posts: Post[] = [];
    return { ...thread, posts };
  }

  /**
   * Create a new thread and an initial post.
   */
  @traceMethod
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

    const image = data.image ? data.image : undefined;
    // Create the initial post.
    await this.createPost(
      threadId,
      { text: data.initial_post, image },
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
  @traceMethod
  async deleteThread(threadId: number): Promise<void> {
    await this.d1
      .prepare("DELETE FROM threads WHERE id = ?")
      .bind(threadId)
      .run();
  }

  /**
   * Update an existing thread.
   */
  @traceMethod
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
  @traceMethod
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

    const image = data.image;
    let objectName: string | null = null;
    if (image) {
      const imageBuffer = await image.arrayBuffer();
      const imageArray = new Uint8Array(imageBuffer);
      objectName = `uploads/${threadId}-${Date.now()}-${image.name}`;
      const object = await this.bucket.put(objectName, imageArray);
    }

    const stmt = this.d1.prepare(`
      INSERT INTO posts (thread_id, author, text, image, is_initial_post)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await stmt
      .bind(threadId, author, data.text, objectName, 0)
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
   * Get the file contents for a post's image (from the bucket).
   */
  @traceMethod
  async getPostImage(fileId: string): Promise<R2ObjectBody | null> {
    const object: R2ObjectBody = await this.bucket.get(fileId);
    if (!object) {
      return null;
    }

    return object;
  }

  /**
   * Get the file contents for a document file (from the bucket).
   */
  @traceMethod
  async getDocumentFile(fileId: string): Promise<R2ObjectBody | null> {
    const object: R2ObjectBody = await this.bucket.get(fileId);
    if (!object) {
      return null;
    }

    return object;
  }

  /**
   * Retrieve all posts for a given thread (ordered by time).
   */
  @traceMethod
  async getPosts(threadId: number): Promise<Post[]> {
    const stmt = this.d1.prepare(
      "SELECT * FROM posts WHERE thread_id = ? ORDER BY time DESC"
    );
    const result = await stmt.bind(threadId).all();
    return (result.results as Post[]) || [];
  }

  /**
   * Retrieve the latest posts for a given thread via cursor-based pagination.
   *
   * This method uses the last seen post's time as a cursor to ensure consistent results
   * even if new posts are added. If no cursor is provided, it returns the first page of posts.
   *
   * @param threadId - The thread identifier.
   * @param limit - The number of posts per page.
   * @param lastPostTime - Optional. The timestamp of the last post from the previous page.
   * @returns A promise that resolves to an array of posts.
   */
  async getLatestPosts(
    threadId: number,
    limit: number = 10,
    lastPostTime?: number
  ): Promise<Post[]> {
    let query = "SELECT * FROM posts WHERE thread_id = ? ";
    const params: any[] = [threadId];
    // If a cursor is provided, fetch posts older than the last seen post.
    if (lastPostTime !== undefined) {
      query += "AND time < ? ";
      params.push(lastPostTime);
    }

    // Order by descending time and limit the results.
    query += "ORDER BY time DESC LIMIT ?";
    params.push(limit);

    const stmt = this.d1.prepare(query);
    const result = await stmt.bind(...params).all();
    return (result.results as Post[]) || [];
  }

  /**
   * Update a post's view count, seen status, and last viewed timestamp.
   */
  @traceMethod
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
  @traceMethod
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
  @traceMethod
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
  @traceMethod
  async deletePost(postId: number): Promise<void> {
    await this.d1.prepare("DELETE FROM posts WHERE id = ?").bind(postId).run();
  }

  /**
   * Add a webhook for a thread.
   */
  @traceMethod
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
  @traceMethod
  async removeWebhook(webhookId: number): Promise<void> {
    await this.d1
      .prepare("DELETE FROM webhooks WHERE id = ?")
      .bind(webhookId)
      .run();
  }

  /**
   * Get all webhooks for a thread.
   */
  @traceMethod
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
  @traceMethod
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
  @traceMethod
  async createDocument(
    threadId: number,
    data: {
      title: string;
      content: string;
      type: string;
      file?: File;
    }
  ): Promise<Document> {
    // Verify the thread exists
    const threadStmt = this.d1.prepare("SELECT * FROM threads WHERE id = ?");
    const thread = await threadStmt.bind(threadId).first();
    if (!thread) {
      throw new Error("Thread not found");
    }

    // For multimedia files, store them in the bucket instead of directly in the database
    let content = data.content;
    let objectName = null;

    // Check if this is a multimedia file that needs special handling
    const isMultimedia =
      data.type.startsWith("audio/") ||
      data.type.startsWith("video/") ||
      data.type.startsWith("image/") ||
      (data.content.length > 100000 && data.file); // Large content

    if (isMultimedia && data.file) {
      // Store the file in the bucket
      const fileBuffer = await data.file.arrayBuffer();
      const fileArray = new Uint8Array(fileBuffer);

      let fname = data.file.name;

      // update the fname to remove spaces and any special characters
      const fnameParts = fname.split(".");
      const ext = fnameParts[fnameParts.length - 1];
      const fnameNoExt = fnameParts.slice(0, -1).join("");
      const fnameNoSpecialChars = fnameNoExt.replace(/[^a-zA-Z0-9]/g, "");
      fname = `${fnameNoSpecialChars}.${ext}`;

      objectName = `uploads/${threadId}-${Date.now()}-${fname}`;
      await this.bucket.put(objectName, fileArray);
      // Store only the reference to the file in the content field
      content = objectName;
    }

    const stmt = this.d1.prepare(`
      INSERT INTO documents (thread_id, title, content, type)
      VALUES (?, ?, ?, ?)
    `);
    const result = await stmt
      .bind(threadId, data.title, content, data.type)
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
  @traceMethod
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
  @traceMethod
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
  @traceMethod
  async deleteDocument(documentId: string): Promise<void> {
    await this.d1
      .prepare("DELETE FROM documents WHERE id = ?")
      .bind(documentId)
      .run();
  }

  /**
   * Get all documents for a thread.
   */
  @traceMethod
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
  @traceMethod
  async getAPIKey(keyId: string): Promise<APIKey> {
    const stmt = this.d1.prepare("SELECT * FROM api_keys WHERE id = ?");
    const apiKey = (await stmt.bind(keyId).first()) as APIKey | undefined;
    if (!apiKey) {
      throw new Error("API key not found");
    }
    return apiKey;
  }

  /**
   * Retrieve an API key by its thread ID.
   */
  @traceMethod
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
  @traceMethod
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
    // Generate a random API key.
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
  @traceMethod
  async updateAPIKey(keyId: string, permissions: any): Promise<APIKey> {
    console.log("D1 updateAPIKey", keyId, permissions);
    const stmt = this.d1.prepare(`
      UPDATE api_keys
      SET permissions = ?
      WHERE id = ?
    `);

    // if permissions is an object, stringify it
    const permissionsString =
      typeof permissions === "object"
        ? JSON.stringify(permissions)
        : permissions;

    const result = await stmt.bind(permissionsString, keyId).run();

    console.log("updateAPIKey", keyId, permissions);
    if (!result.success) {
      throw new Error("API key update failed");
    }

    const apiKey = await this.getAPIKey(keyId);
    if (!apiKey) {
      throw new Error("Error retrieving API key after update");
    }
    return apiKey;
  }

  /**
   * Delete an API key.
   */
  @traceMethod
  async deleteAPIKey(key: string): Promise<void> {
    console.log("deleteAPIKey", key);
    await this.d1.prepare("DELETE FROM api_keys WHERE id = ?").bind(key).run();
  }

  // Add these methods to your D1ThreadClient class

  /**
   * Search for posts containing specific text, optionally within a specific thread.
   * Uses FTS5 for efficient text search.
   *
   * @param query - The search query string
   * @param threadId - Optional. If provided, search only within this thread
   * @param limit - Optional. The maximum number of results to return (default: 20)
   * @param offset - Optional. The number of results to skip (for pagination, default: 0)
   * @returns A promise that resolves to an array of posts matching the search criteria
   */
  @traceMethod
  async searchPosts(
    query: string,
    threadId?: number | null,
    limit: number = 20,
    offset: number = 0
  ): Promise<Post[]> {
    // Sanitize the search query to prevent SQL injection
    const sanitizedQuery = this.sanitizeSearchQuery(query);

    // Build the query with or without thread_id filter
    let sql = `
    SELECT p.*
    FROM posts p
    JOIN posts_fts fts ON p.id = fts.rowid
    WHERE posts_fts MATCH ?
  `;

    const params: any[] = [sanitizedQuery];

    // Add thread filter if provided
    if (threadId) {
      sql += " AND p.thread_id = ?";
      params.push(threadId);
    }

    // Add sorting, limit and offset
    sql += `
    ORDER BY
      rank, -- FTS5 automatically provides a rank column
      p.time DESC
    LIMIT ? OFFSET ?
  `;
    params.push(limit, offset);

    // Execute the query
    const stmt = this.d1.prepare(sql);
    const result = await stmt.bind(...params).all();

    return (result.results as Post[]) || [];
  }

  /**
   * Sanitize a search query to make it safe for FTS5 and prevent injection attacks
   *
   * @param query - The raw search query string
   * @returns A sanitized query string safe for using in FTS5 MATCH expressions
   */
  private sanitizeSearchQuery(query: string): string {
    // Remove any FTS5 syntax that could be used for injection
    let sanitized = query
      .replace(/['"\\]/g, " ") // Remove quotes and backslashes
      .replace(/AND|OR|NOT|NEAR|COLUMN/gi, " ") // Remove FTS5 operators
      .trim();

    // If the query is now empty, use a simple term that matches nothing
    if (!sanitized) {
      return "xyznonexistentterm123";
    }

    // Add asterisks for partial matching (like %term% in LIKE)
    const terms = sanitized.split(/\s+/).filter((term) => term.length > 0);
    return terms.map((term) => `"${term}"*`).join(" OR ");
  }

  /**
   * Get thread search suggestions as you type
   *
   * @param query - The partial search query string
   * @param limit - Optional. The maximum number of suggestions to return (default: 5)
   * @returns A promise that resolves to an array of suggestion objects
   */
  @traceMethod
  async getSearchSuggestions(query: string, limit: number = 5): Promise<any[]> {
    const sanitizedQuery = this.sanitizeSearchQuery(query);

    // This query gets unique terms and the count of posts containing them
    const sql = `
    SELECT
      text AS preview,
      thread_id,
      author,
      COUNT(*) AS count
    FROM posts_fts
    WHERE posts_fts MATCH ?
    GROUP BY thread_id
    ORDER BY count DESC
    LIMIT ?
  `;

    const stmt = this.d1.prepare(sql);
    const result = await stmt.bind(sanitizedQuery, limit).all();

    const suggestions = (result.results as any[]) || [];

    // For each suggestion, get the thread title
    for (const suggestion of suggestions) {
      const thread = await this.d1
        .prepare("SELECT title FROM threads WHERE id = ?")
        .bind(suggestion.thread_id)
        .first();

      if (thread) {
        suggestion.thread_title = thread.title;
      }
    }

    return suggestions;
  }

  /**
   * Get search statistics - count how many posts match the query
   *
   * @param query - The search query string
   * @param threadId - Optional. If provided, count only within this thread
   * @returns A promise that resolves to an object with search statistics
   */
  @traceMethod
  async getSearchStats(
    query: string,
    threadId?: number
  ): Promise<{ count: number }> {
    const sanitizedQuery = this.sanitizeSearchQuery(query);

    let sql = `
    SELECT COUNT(*) as count
    FROM posts_fts
    WHERE posts_fts MATCH ?
  `;

    const params: any[] = [sanitizedQuery];

    if (threadId) {
      sql += " AND thread_id = ?";
      params.push(threadId);
    }

    const stmt = this.d1.prepare(sql);
    const result = await stmt.bind(...params).first();

    return { count: result?.count || 0 };
  }
}
