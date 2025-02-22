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
  APIKey,
} from "./types";

/**
 * RestThreadClient implements ThreadClient by interacting with the server via REST calls.
 * It exposes the same methods as the local (SQLite) client so you can swap them interchangeably.
 */
export class RestThreadClient extends ThreadClient {
  private apiKey?: string;
  private narrowToken?: string;

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

    if (this.narrowToken) {
      headers.set("Authorization", `Bearer narrow_${this.narrowToken}`);
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

  // update thread
  async updateThread(
    threadId: number,
    data: { title: string; sharePubkey?: string }
  ): Promise<Thread> {
    const formData = new FormData();
    formData.append("title", data.title);
    if (data.sharePubkey) {
      formData.append("sharePubkey", data.sharePubkey);
    }

    const response = await this.makeRequest(`/api/threads/${threadId}`, {
      method: "PUT",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
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
    data: {
      id: string;
      title: string;
      content: string;
      type: string;
    }
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

  // API Key Management

  async getAPIKey(key: string): Promise<APIKey> {
    const response = await this.makeRequest(`/api/api_keys/${key}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async getThreadApiKeys(threadId: number): Promise<APIKey[]> {
    const response = await this.makeRequest(`/api/thread/${threadId}/apikeys`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async createAPIKey(
    threadId: number,
    keyName: string,
    permissions: any
  ): Promise<APIKey> {
    const response = await this.makeRequest(`/api/thread/${threadId}/apikeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyName, permissions }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async updateAPIKey(key: string, permissions: any): Promise<APIKey> {
    const response = await this.makeRequest(`/api/api_keys/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  async deleteAPIKey(key: string): Promise<void> {
    const response = await this.makeRequest(`/api/api_keys/${key}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  // special for narrow access
  setNarrowToken(token: string) {
    this.narrowToken = token;
  }
}
