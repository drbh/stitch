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
  constructor(private baseURL: string = "http://localhost:8000") {
    super();
  }

  /**
   * Retrieves all threads.
   */
  async getThreads(): Promise<Thread[]> {
    const response = await fetch(`${this.baseURL}/api/threads`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  /**
   * Retrieves a single thread (with posts and documents) by ID.
   */
  async getThread(threadId: number): Promise<Thread | null> {
    const response = await fetch(`${this.baseURL}/api/threads/${threadId}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  /**
   * Creates a new thread. We use FormData because the FastAPI endpoint for creating threads
   * expects form data (and optionally an UploadFile for the image).
   */
  async createThread(data: ThreadCreateData): Promise<Thread> {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("creator", data.creator);
    formData.append("initial_post", data.initial_post);
    // If an image is provided, append it (it could be a File or a string)
    if (data.image) {
      formData.append("image", data.image);
    }

    const response = await fetch(`${this.baseURL}/api/threads`, {
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
    const response = await fetch(`${this.baseURL}/api/threads/${threadId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  /**
   * Creates a new post in a thread.
   * If the author is 'system', we use the JSON endpoint;
   * otherwise, we send form data.
   */
  async createPost(
    threadId: number,
    data: PostCreateData,
    author: string = "user"
  ): Promise<Post> {
    if (author === "system") {
      // Use the JSON endpoint
      const response = await fetch(
        `${this.baseURL}/api/system/threads/${threadId}/posts`,
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
      // Use the form-data endpoint
      const formData = new FormData();
      formData.append("text", data.text);
      if (data.image) {
        formData.append("image", data.image);
      }
      const response = await fetch(
        `${this.baseURL}/api/threads/${threadId}/posts`,
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
    const response = await fetch(
      `${this.baseURL}/api/threads/${threadId}/posts`
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }
}
