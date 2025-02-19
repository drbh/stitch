import {
  ThreadClient,
  Thread,
  ThreadCreateData,
  Post,
  PostCreateData,
} from "./types";

/**
 * RestThreadClient implements ThreadClient by interacting with the server via REST calls.
 * It exposes the same methods as the local (SQLite) client so you can swap them interchangeably.
 */
export class RestThreadClient extends ThreadClient {
  private apiKey?: string;

  constructor(
    private baseURL: string = "http://localhost:8000",
    apiKey?: string
  ) {
    super();
    this.apiKey = apiKey;
  }

  /**
   * Internal method to make requests with consistent headers
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers);

    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });
  }

  /**
   * Retrieves all threads.
   */
  async getThreads(): Promise<Thread[]> {
    const response = await this.makeRequest("/api/threads");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  /**
   * Retrieves a single thread (with posts and documents) by ID.
   */
  async getThread(threadId: number): Promise<Thread | null> {
    const response = await this.makeRequest(`/api/threads/${threadId}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  /**
   * Creates a new thread with form data support.
   */
  async createThread(data: ThreadCreateData): Promise<Thread> {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("creator", data.creator);
    formData.append("initial_post", data.initial_post);
    if (data.image) {
      formData.append("image", data.image);
    }

    const response = await this.makeRequest("/api/threads", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  /**
   * Deletes a thread by its ID.
   */
  async deleteThread(threadId: number): Promise<void> {
    const response = await this.makeRequest(`/api/threads/${threadId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  /**
   * Creates a new post in a thread.
   */
  async createPost(
    threadId: number,
    data: PostCreateData,
    author: string = "user"
  ): Promise<Post> {
    if (author === "system") {
      const response = await this.makeRequest(
        `/api/system/threads/${threadId}/posts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return await response.json();
    } else {
      const formData = new FormData();
      formData.append("text", data.text);
      if (data.image) {
        formData.append("image", data.image);
      }
      const response = await this.makeRequest(
        `/api/threads/${threadId}/posts`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return await response.json();
    }
  }

  /**
   * Retrieves all posts for a given thread.
   */
  async getPosts(threadId: number): Promise<Post[]> {
    const response = await this.makeRequest(`/api/threads/${threadId}/posts`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }
}
