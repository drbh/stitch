import {
  ThreadClient,
  Thread,
  ThreadCreateData,
  Post,
  PostCreateData,
  Document,
  DocumentCreateData,
  DocumentUpdateData,
  Webhook,
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

  // Thread Management

  async getThreads(): Promise<Thread[]> {
    const response = await this.makeRequest("/api/threads");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

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

  async deleteThread(threadId: number): Promise<void> {
    const response = await this.makeRequest(`/api/threads/${threadId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  // Post Management

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

  async getPosts(threadId: number): Promise<Post[]> {
    const response = await this.makeRequest(`/api/threads/${threadId}/posts`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async getPost(postId: number): Promise<Post> {
    const response = await this.makeRequest(`/api/posts/${postId}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async updatePost(
    postId: number,
    data: { text: string; image?: File }
  ): Promise<Post> {
    const response = await this.makeRequest(`/api/posts/${postId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async deletePost(postId: number): Promise<void> {
    const response = await this.makeRequest(`/api/posts/${postId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  // Document Management

  async getThreadDocuments(threadId: number): Promise<Document[]> {
    const response = await this.makeRequest(
      `/api/threads/${threadId}/documents`
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async createDocument(
    threadId: number,
    data: DocumentCreateData
  ): Promise<Document> {
    const response = await this.makeRequest("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, thread_id: threadId }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async getDocument(docId: string): Promise<Document | null> {
    const response = await this.makeRequest(`/api/documents/${docId}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async updateDocument(
    docId: string,
    data: DocumentUpdateData
  ): Promise<Document> {
    const response = await this.makeRequest(`/api/documents/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async deleteDocument(docId: string): Promise<void> {
    const response = await this.makeRequest(`/api/documents/${docId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  // Webhook Management

  async getThreadWebhooks(threadId: number): Promise<Webhook[]> {
    const response = await this.makeRequest(
      `/api/threads/${threadId}/webhooks`
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async addWebhook(
    threadId: number,
    url: string,
    apiKey?: string
  ): Promise<Webhook> {
    const response = await this.makeRequest(
      `/api/threads/${threadId}/webhooks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, api_key: apiKey }),
      }
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async removeWebhook(webhookId: number): Promise<void> {
    const response = await this.makeRequest(`/api/webhooks/${webhookId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }
}
