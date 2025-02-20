/**
 * Interfaces to represent Threads, Posts, and Documents.
 */
export interface Thread {
  id: number;
  title: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  last_activity: string; // ISO timestamp
  creator: string;
  view_count: number;
  reply_count: number;
  posts?: Post[];
  documents?: Document[];

  location?: string;
  webhooks?: Webhook[];
}

export interface ThreadCreateData {
  title: string;
  creator: string;
  initial_post: string;
  image?: string;
}

export interface Post {
  id: number;
  thread_id: number;
  author: string;
  text: string;
  time: string; // ISO timestamp
  image?: string;
  edited: boolean;
  seen: boolean;
  view_count: number;
  last_viewed?: string;
  is_initial_post: boolean;
}

export interface PostCreateData {
  text: string;
  image?: string;
}

export interface Document {
  id: string;
  thread_id: number;
  title: string;
  content: string;
  type: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  last_viewed?: string; // ISO timestamp
  view_count: number;
}

export interface DocumentCreateData
  extends Omit<
    Document,
    "id" | "created_at" | "updated_at" | "last_viewed" | "view_count"
  > {}

/**
 * The abstract ThreadClient defines the operations for managing threads,
 * posts, documents, and webhooks.
 */
export abstract class ThreadClient {
  // Thread operations
  abstract getThreads(): Promise<Thread[]>;
  abstract getThread(threadId: number): Promise<Thread | null>;
  abstract createThread(data: ThreadCreateData): Promise<Thread>;
  abstract deleteThread(threadId: number): Promise<void>;

  // Post operations
  abstract createPost(
    threadId: number,
    data: PostCreateData,
    author?: string
  ): Promise<Post>;
  abstract getPosts(threadId: number): Promise<Post[]>;
  abstract getPost(postId: number): Promise<Post>;
  abstract updatePost(
    postId: number,
    data: { text: string; image?: File }
  ): Promise<Post>;
  abstract deletePost(postId: number): Promise<void>;

  // Document operations
  abstract getThreadDocuments(threadId: number): Promise<Document[]>;
  abstract createDocument(
    threadId: number,
    data: DocumentCreateData
  ): Promise<Document>;
  abstract getDocument(docId: string): Promise<Document | null>;
  abstract updateDocument(
    docId: string,
    data: DocumentUpdateData
  ): Promise<Document>;
  abstract deleteDocument(docId: string): Promise<void>;

  // Webhook operations
  abstract getThreadWebhooks(threadId: number): Promise<Webhook[]>;
  abstract addWebhook(
    threadId: number,
    url: string,
    apiKey?: string
  ): Promise<Webhook>;
  abstract removeWebhook(webhookId: number): Promise<void>;
}

export type StorageClients = Record<string, ThreadClient>;

/**
 * Represents a backend connection to a storage server.
 */
export interface BackendConnection {
  id: string;
  name: string;
  url: string;
  token: string;
  isActive: boolean;
}

export interface DocumentCreateData {
  title: string;
  content: string;
  type: string;
}

export interface DocumentUpdateData {
  title?: string;
  content?: string;
  type?: string;
}

export interface Webhook {
  id: number;
  thread_id: number;
  url: string;
  api_key?: string;
  last_triggered?: string;
}
