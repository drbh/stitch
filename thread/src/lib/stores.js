import { writable } from "svelte/store";

export const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:8000/api"
    : // replace the port number with the port number of the deployed server :5000
      `http://${window.location.hostname}:8000/api`;

console.log(API_BASE);

// Threads store
// export const threads = writable([]);
// export const activeThread = writable(null);

// Create a new thread
export async function createThread(
  title,
  creator,
  initialPost,
  imageFile,
  before,
  onComplete
) {
  before();

  try {
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("creator", creator.trim());
    formData.append("initial_post", initialPost.trim());

    if (imageFile) {
      formData.append("image", imageFile);
    }

    const response = await fetch(`${API_BASE}/threads`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to create thread");
    }

    const newThread = await response.json();
    threads.update((t) => [newThread, ...t]);
    onComplete();
  } catch (error) {
    console.error("Error creating thread:", error);
    alert("Failed to create thread. Please try again.");
  }
}

// Create a post within a thread
export async function createPost(
  threadId,
  text,
  imageFile,
  before,
  onComplete
) {
  before();

  try {
    const formData = new FormData();
    formData.append("text", text.trim());

    if (imageFile) {
      formData.append("image", imageFile);
    }

    const response = await fetch(`${API_BASE}/threads/${threadId}/posts`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to create post");
    }

    const newPost = await response.json();
    posts.update((p) => [newPost, ...p]);
    onComplete();
  } catch (error) {
    console.error("Error creating post:", error);
    alert("Failed to create post. Please try again.");
  }
}

// Fetch all threads
export const fetchThreads = async () => {
  try {
    const response = await fetch(`${API_BASE}/threads`);
    const data = await response.json();
    threads.set(
      data.map((thread) => ({
        ...thread,
        created_at: new Date(thread.created_at),
        updated_at: new Date(thread.updated_at),
        last_activity: new Date(thread.last_activity),
      }))
    );
  } catch (error) {
    console.error("Error fetching threads:", error);
  }
};

// Fetch a specific thread with its posts
export const fetchThread = async (threadId) => {
  try {
    const response = await fetch(`${API_BASE}/threads/${threadId}`);
    const data = await response.json();
    console.log(">", data);
    const thread = {
      ...data,
      created_at: new Date(data.created_at + "Z"),
      updated_at: new Date(data.updated_at + "Z"),
      last_activity: new Date(data.last_activity + "Z"),
      posts: data.posts.map((post) => ({
        ...post,
        time: new Date(post.time + "Z"),
        last_viewed: post.last_viewed ? new Date(post.last_viewed + "Z") : null,
      })),
    };
    activeThread.set(thread);
  } catch (error) {
    console.error("Error fetching thread:", error);
  }
};

export const deleteThread = async (id) => {
  try {
    const response = await fetch(`${API_BASE}/threads/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      threads.update((t) => t.filter((thread) => thread.id !== id));
    }
  } catch (error) {
    console.error("Error deleting thread:", error);
    throw error;
  }
};

// Document data store
// export const documents = writable({});

// export async function createPost(text, imageFile, before, onComplete) {
//   before();
//   // if (!isValid) return;
//   // isPosting = true;

//   try {
//     const formData = new FormData();
//     let _text = text.trim();
//     console.log(_text);

//     formData.append("text", text.trim());

//     if (imageFile) {
//       formData.append("image", imageFile);
//     }
//     console.log(formData);
//     const response = await fetch(`${API_BASE}/posts`, {
//       method: "POST",
//       body: formData,
//     });

//     if (!response.ok) {
//       throw new Error("Failed to create post");
//     }

//     const newPost = await response.json();
//     posts.update((p) => [newPost, ...p]);

//     // // Reset form
//     // text = "";
//     // charCount = 0;
//     // imageFile = null;
//     // imagePreview = null;
//     // if (fileInput) {
//     //   fileInput.value = "";
//     // }

//     // dispatch("posted");

//     onComplete();
//   } catch (error) {
//     console.error("Error creating post:", error);
//     alert("Failed to create post. Please try again.");
//   } finally {
//     // isPosting = false;
//   }
// }

export async function createDocument(newDoc, threadId, onComplete) {
  if (!newDoc.title.trim()) return;

  try {
    const response = await fetch(`${API_BASE}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: newDoc.title.toLowerCase().replace(/\s+/g, "-"),
        thread_id: threadId,
        ...newDoc,
      }),
    });

    if (!response.ok) throw new Error("Failed to create document");

    const doc = await response.json();
    documents.update((docs) => ({
      ...docs,
      [doc.id]: doc,
    }));

    // Reset form
    newDoc = {
      title: "",
      content: "",
      type: "text",
    };
    onComplete();
  } catch (error) {
    console.error("Error creating document:", error);
    alert("Failed to create document. Please try again.");
  }
}

// Update a document
export async function updateDocument(updatedDoc, onComplete) {
  try {
    const response = await fetch(`${API_BASE}/documents/${updatedDoc.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedDoc),
    });

    if (!response.ok) throw new Error("Failed to update document");

    documents.update((docs) => ({
      ...docs,
      [updatedDoc.id]: updatedDoc,
    }));

    onComplete();
  } catch (error) {
    console.error("Error updating document:", error);
    alert("Failed to update document. Please try again.");
  }
}

// Fetch all documents
export const fetchDocuments = async () => {
  try {
    const response = await fetch(`${API_BASE}/documents`);
    const data = await response.json();
    documents.set(data);
  } catch (error) {
    console.error("Error fetching documents:", error);
  }
};

export const removeDocument = async (id) => {
  try {
    const response = await fetch(`${API_BASE}/documents/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      documents.update((docs) => {
        const newDocs = { ...docs };
        delete newDocs[id];
        return newDocs;
      });
    }

    // remove that document from the thread
    documents.update((docs) => {
      const newDocs = { ...docs };
      delete newDocs[id];
      return newDocs;
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
};

// Posts store with new attributes
// export const posts = writable([]);

// Fetch all posts
export const fetchPosts = async () => {
  try {
    const response = await fetch(`${API_BASE}/posts`);
    const data = await response.json();
    posts.set(
      data.map((post) => ({
        ...post,
        time: new Date(post.time),
        last_viewed: post.last_viewed ? new Date(post.last_viewed) : null,
      }))
    );
  } catch (error) {
    console.error("Error fetching posts:", error);
  }
};

// Delete a post
export const removePost = async (id) => {
  try {
    const response = await fetch(`${API_BASE}/posts/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      posts.update((p) => p.filter((post) => post.id !== id));
    }
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
};

// Toggle like on a post
export const togglePostLike = async (post) => {
  try {
    const endpoint = post.liked ? "unlike" : "like";
    const response = await fetch(`${API_BASE}/posts/${post.id}/${endpoint}`, {
      method: "POST",
    });
    const updatedPost = await response.json();

    posts.update((p) =>
      p.map((existingPost) =>
        existingPost.id === post.id
          ? { ...updatedPost, liked: !post.liked }
          : existingPost
      )
    );
  } catch (error) {
    console.error("Error toggling like:", error);
    throw error;
  }
};

// Active document store
// export const activeDocument = writable(null);

// Initialize data
// fetchDocuments();
// fetchPosts();
// fetchThreads();

// At the top where stores are created:
const savedState = JSON.parse(localStorage.getItem("appState") || "{}");
// const savedState = JSON.parse("{}");

export const panelWidth = writable(savedState.panelWidth || 300);
export const isSidebarExpanded = writable(
  savedState.isSidebarExpanded || false
);
export const threads = writable(savedState.threads || []);
// export const threads = writable([]);
export const activeThread = writable(savedState.activeThread || null);
export const activeDocument = writable(savedState.activeDocument || null);
// export const posts = writable(savedState.posts || []);

if (savedState.posts) {
  // parse the dates
  // console.log("-", savedState.posts);
  savedState.posts = savedState.posts.map((post) => ({
    ...post,
    time: new Date(post.time),
    last_viewed: post.last_viewed ? new Date(post.last_viewed) : null,
  }));
  // console.log("+", savedState.posts);
}

export const posts = writable(savedState.posts || []);

export const documents = writable(savedState.documents || {});

// Track state changes remains the same
const stores = {
  threads,
  activeThread,
  activeDocument,
  posts,
  documents,
  panelWidth,
  isSidebarExpanded,
};
Object.entries(stores).forEach(([key, store]) => {
  store.subscribe((value) => {
    const currentState = JSON.parse(localStorage.getItem("appState") || "{}");
    localStorage.setItem(
      "appState",
      JSON.stringify({
        ...currentState,
        [key]: value,
      })
    );
  });
});

fetchThreads();

let previousThreadId = null;

// if activeThread is set, fetch the documents for that thread
activeThread.subscribe((thread) => {
  if (thread) {
    let _posts = thread.posts.map((post) => ({
      ...post,
      time: new Date(post.time),
      last_viewed: post.last_viewed ? new Date(post.last_viewed) : null,
    }));
    console.log("POSTS", _posts);
    // posts.set(thread.posts);
    posts.set(_posts);
    // documents.set(thread.documents);
  }

  if (previousThreadId && previousThreadId !== thread.id) {
    activeDocument.set(null);
  }

  previousThreadId = thread ? thread.id : null;
});
