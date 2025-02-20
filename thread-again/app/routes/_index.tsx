import React, { useState, useEffect } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { clientMiddleware } from "~/middleware/storageClient";
import type { Thread, BackendConnection } from "~/clients/types";
import SettingsModal from "~/components/SettingsModal";

type LoaderData = {
  threads: Thread[];
  activeThread: Thread | null;
  servers: string[];
  backendMetadata: BackendConnection[];
};

export const loader: LoaderFunction = async ({ request, context }) => {
  const threads: Array<Thread> = [];
  let activeThread = null;

  const url = new URL(request.url);
  const threadId = url.searchParams.get("t");
  const server = url.searchParams.get("s");

  // inplace update the clientMiddleware
  await clientMiddleware(request, context);
  const storageClients = context.storageClients;
  const backendsJson = context.backendsJson;

  // if storageClients not in context, return empty threads
  if (!storageClients) {
    return Response.json({ threads, activeThread }, { status: 200 });
  }

  const servers = Object.keys(storageClients);
  for (const server of servers) {
    try {
      const serverThreads = await storageClients[server].getThreads();
      serverThreads.forEach((thread) => {
        thread.location = server;
      });
      threads.push(...serverThreads);
    } catch (error) {
      // @ts-ignore-next-line
      console.error(`Error fetching threads from ${server}: ${error.message}`);
    }
  }

  if (threadId && server) {
    try {
      activeThread = await context.storageClients[server].getThread(
        parseInt(threadId)
      );

      if (activeThread && activeThread.posts) {
        activeThread.posts.sort((a, b) => b.id - a.id);
        activeThread.location = server;

        // get all the webhooks for the active thread
        const webhooks = await context.storageClients[server].getThreadWebhooks(
          parseInt(threadId)
        );
        activeThread.webhooks = webhooks;

        // get all the documents for the active thread
        const documents = await context.storageClients[
          server
        ].getThreadDocuments(parseInt(threadId));
        activeThread.documents = documents;
      }
    } catch (error) {
      // if the thread is not found, set activeThread to null
      activeThread = null;
    }
  }

  // Properly format the cookie string
  const cookieOptions = [
    `last_visited=${new Date().toISOString()} ${"test"}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=31536000",
  ];

  const backendMetadata = backendsJson.map((backend) => {
    const { id, name, url, token, isActive } = backend;
    const hiddenToken = null;
    // TODO: handle something like - token ? "*".repeat(32) : "";
    return { id, name, url, token: hiddenToken, isActive };
  });

  const data: LoaderData = {
    threads: threads,
    activeThread,
    servers,
    backendMetadata,
  };

  // Create response using Response.json()
  const response = Response.json(data, {
    headers: {
      "Set-Cookie": cookieOptions.join("; "),
    },
  });

  return response;
};

export const action: ActionFunction = async ({ request, context }) => {
  // inplace update the clientMiddleware
  await clientMiddleware(request, context);

  // get the headers from the request
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createThread") {
    const location = String(formData.get("location"));
    const title = String(formData.get("title"));
    const content = String(formData.get("content"));

    if (!location || !title || !content) {
      return new Response(null, { status: 400 });
    }

    // create the thread in the selected server
    const _newThread = await context.storageClients[location].createThread({
      title,
      creator: "system",
      initial_post: content,
    });

    const data: { success: boolean } = { success: true };
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response;
  } else if (intent === "createPost") {
    const content = String(formData.get("content"));
    const url = new URL(request.url);
    const threadId = String(url.searchParams.get("t"));
    const server = String(url.searchParams.get("s"));

    // create the post in the selected server
    const _newPost = await context.storageClients[server].createPost(
      parseInt(threadId),
      { text: content }
    );

    const data: { success: boolean } = { success: true };
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response;
  } else if (intent === "updateBackends") {
    const jsonString = formData.getAll("backends");
    if (!jsonString) {
      return new Response(null, { status: 400 });
    }
    const backends = JSON.parse(String(jsonString));
    // serialize and base64 encode the backends
    // const serverData = btoa(JSON.stringify(backends));
    const serverData = JSON.stringify(backends);

    // update the cookies so we can use the new servers
    const cookieOptions = [
      `backends=${serverData}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=31536000",
    ];
    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieOptions.join("; "),
      },
    });
  } else if (intent === "createWebhook") {
    const url = String(formData.get("url"));
    const secret = String(formData.get("secret"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!url) {
      return new Response(null, { status: 400 });
    }

    // addWebhook
    const _newWebhook = await context.storageClients[server].addWebhook(
      parseInt(threadId),
      url,
      secret
    );

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "removeWebhook") {
    const webhookId = String(formData.get("webhookId"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!webhookId) {
      return new Response(null, { status: 400 });
    }

    await context.storageClients[server].removeWebhook(parseInt(webhookId));

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "createDocument") {
    const title = String(formData.get("title"));
    const content = String(formData.get("content"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!title || !content) {
      return new Response(null, { status: 400 });
    }

    // createDocument
    const _newDocument = await context.storageClients[server].createDocument(
      parseInt(threadId),
      { title, content, type: "text" }
    );

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "deleteDocument") {
    const docId = String(formData.get("docId"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!docId) {
      return new Response(null, { status: 400 });
    }

    // deleteDocument
    await context.storageClients[server].deleteDocument(docId);

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "deleteThread") {
    const threadId = String(formData.get("threadId"));
    const server = String(formData.get("server"));

    if (!threadId || !server) {
      return new Response(null, { status: 400 });
    }

    // deleteThread
    await context.storageClients[server].deleteThread(parseInt(threadId));

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  if (intent === "deletePost") {
    const postId = String(formData.get("postId"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!postId) {
      return new Response(null, { status: 400 });
    }

    // deletePost
    await context.storageClients[server].deletePost(parseInt(postId));

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else {
    return new Response(null, { status: 400 });
  }
};

export default function Index() {
  const { threads, activeThread, servers, backendMetadata } =
    useLoaderData<LoaderData>();

  const setActiveThread = (thread: Thread | null) => {
    const url = new URL(window.location.toString());
    if (!thread) {
      url.searchParams.delete("t");
      url.searchParams.delete("s");
    } else {
      url.searchParams.set("t", String(thread.id));
      url.searchParams.set("s", String(thread.location));
    }
    window.history.pushState({}, "", url);
    window.location.reload();
  };

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveThread(null);
      }
    };
    window.addEventListener("keydown", handleKeydown);

    // if activeThread is set, update the URL
    if (activeThread) {
      const url = new URL(window.location.toString());
      url.searchParams.set("t", String(activeThread.id));
      url.searchParams.set("s", String(activeThread.location));
      window.history.pushState({}, "", url);
    } else {
      // remove the t and s params from the URL
      const url = new URL(window.location.toString());
      url.searchParams.delete("t");
      url.searchParams.delete("s");
      window.history.pushState({}, "", url);
    }

    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary">
      <Topbar openSettings={() => setShowSettings(true)} />
      <div className="flex">
        <Sidebar
          servers={servers}
          threads={threads}
          setActiveThread={setActiveThread}
          activeThread={activeThread}
        />
        <MainContent activeThread={activeThread} />
        {/* <DocumentPanel /> */}
      </div>
      {showSettings && (
        <SettingsModal
          backendMetadata={backendMetadata}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function Topbar({ openSettings }: { openSettings: () => void }) {
  return (
    <header className="h-16 bg-surface-secondary border-b border-border shadow-lg flex justify-between items-center px-6">
      <h1 className="text-xl font-bold text-content-accent">ThreadApp</h1>
      <button
        onClick={openSettings}
        className="text-content-accent hover:underline"
      >
        Settings
      </button>
    </header>
  );
}

function Sidebar({
  servers,
  threads,
  setActiveThread,
  activeThread,
}: LoaderData & {
  setActiveThread: (thread: Thread | null) => void;
}) {
  return (
    <aside className="w-80 h-[calc(100vh-64px)] bg-surface-secondary border-r border-border overflow-y-auto">
      <div className="p-6 space-y-6">
        <ThreadComposer servers={servers} />
        <ThreadList
          threads={threads}
          setActiveThread={setActiveThread}
          activeThread={activeThread}
        />
      </div>
    </aside>
  );
}

function ThreadComposer({ servers }: { servers: string[] }) {
  const fetcher = useFetcher<{ success: boolean }>();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState(
    servers && servers.length > 0 ? servers[0] : ""
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    fetcher.submit(
      {
        intent: "createThread",
        location,
        title,
        content,
      },
      { method: "post" }
    );
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      // TODO: clear form fields
    }
  }, [fetcher.data]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-content-accent">New Thread</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* a dropdown select of the servers */}
        <label className="block text-sm font-medium mb-1">
          Select a server
        </label>
        <select
          name="server"
          className="w-full border border-border rounded p-2 bg-surface-tertiary"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          {servers &&
            servers.map((server) => (
              <option key={server} value={server}>
                {server}
              </option>
            ))}
        </select>

        <input
          type="text"
          placeholder="Thread Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
        />
        <textarea
          placeholder="Thread Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-2 h-24 bg-surface-tertiary border border-border rounded-lg resize-none focus:ring-2 focus:ring-border-focus focus:border-transparent"
        />
        <button
          type="submit"
          className="w-full px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
        >
          Post Thread
        </button>
      </form>
    </div>
  );
}

function ThreadList({
  threads,
  setActiveThread,
  activeThread,
}: {
  threads: Thread[];
  activeThread: Thread | null;
  setActiveThread: (thread: Thread | null) => void;
}) {
  const fetcher = useFetcher<{ success: boolean }>();

  const handleThreadDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = new URL(window.location.toString());
    const threadId = url.searchParams.get("t");
    const server = url.searchParams.get("s");

    if (!threadId || !server) {
      return;
    }

    fetcher.submit(
      {
        intent: "deleteThread",
        threadId,
        server,
      },
      { method: "delete" }
    );
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      setActiveThread(null);
    }
  }, [fetcher.data]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-content-accent">Threads</h2>
      <ul className="space-y-2">
        {threads.map((thread) => (
          <li
            key={thread.id + thread.location!}
            onClick={() => setActiveThread(thread)}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              activeThread?.id === thread.id &&
              activeThread?.location === thread.location
                ? "bg-interactive text-content-primary"
                : "bg-surface-tertiary hover:bg-interactive-hover"
            }`}
          >
            <h3 className="font-medium truncate">{thread.title}</h3>
            <p className="text-sm text-content-secondary truncate">
              {thread.last_activity}
            </p>
            <div className="flex items-center justify-between">
              {thread.location && (
                <span className="text-xs text-content-secondary">
                  {thread.location}
                </span>
              )}
            </div>
            <button
              className="text-xs text-content-accent hover:underline"
              onClick={handleThreadDelete}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MainContent({ activeThread }: { activeThread: Thread | null }) {
  return (
    <main className="flex-1 h-[calc(100vh-64px)] overflow-y-auto bg-surface-primary p-6">
      {activeThread ? (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-content-accent">
              {activeThread.title}
            </h2>
            <p className="text-content-secondary">
              {activeThread.last_activity}
            </p>
          </div>
          <PostComposer />
          <Thread thread={activeThread} />
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-content-tertiary">
          Select a thread to view details
        </div>
      )}
    </main>
  );
}

function Thread({ thread }: { thread: Thread }) {
  const fetcher = useFetcher<{ success: boolean }>();

  const handleWebhookSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const url = form[0].value;
    const secret = form[1].value || "";
    if (!url) return;

    fetcher.submit(
      {
        intent: "createWebhook",
        url,
        secret,
      },
      { method: "post" }
    );
  };

  const handleWebhookRemove = (e: React.MouseEvent, webhookId: number) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "removeWebhook",
        webhookId,
      },
      { method: "delete" }
    );
  };

  const handleDocumentSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const title = form[0].value;
    const content = form[1].value;
    if (!title || !content) return;

    fetcher.submit(
      {
        intent: "createDocument",
        title,
        content,
      },
      { method: "post" }
    );
  };

  const handleDocumentRemove = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "deleteDocument",
        docId,
      },
      { method: "delete" }
    );
  };

  const handlePostDelete = (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "deletePost",
        postId,
      },
      { method: "delete" }
    );
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      // TODO: clear form fields
      console.log("success");
    }
  }, [fetcher.data]);

  return (
    <div className="space-y-6">
      <div className="bg-surface-secondary rounded-lg shadow-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold text-content-accent">Documents</h2>
        {thread.documents && thread.documents.length > 0 ? (
          <ul className="space-y-4">
            {thread.documents.map((document, index) => (
              <li
                key={document.id}
                className="bg-surface-tertiary p-4 rounded-lg"
              >
                <div>{document.title}</div>
                <div>{document.content}</div>
                <button
                  className="text-xs text-content-accent hover:underline"
                  onClick={(e) => handleDocumentRemove(e, document.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-content-tertiary">No documents configured.</p>
        )}

        {/* add new document form */}
        <h3 className="text-lg font-semibold text-content-accent">
          Add Document
        </h3>
        <form className="space-y-4" onSubmit={handleDocumentSubmit}>
          <input
            type="text"
            placeholder="Document Title"
            className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <textarea
            placeholder="Document Content"
            required={false}
            className="w-full px-4 py-2 h-32 bg-surface-tertiary border border-border rounded-lg resize-none focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
          >
            Add Document
          </button>
        </form>
      </div>

      <div className="bg-surface-secondary rounded-lg shadow-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold text-content-accent">Webhooks</h2>
        {thread.webhooks && thread.webhooks.length > 0 ? (
          <ul className="space-y-4">
            {thread.webhooks.map((webhook, index) => (
              <li
                key={webhook.id}
                className="bg-surface-tertiary p-4 rounded-lg"
              >
                <div>{webhook.url}</div>
                <div>{webhook.secret}</div>
                <button
                  className="text-xs text-content-accent hover:underline"
                  onClick={(e) => handleWebhookRemove(e, webhook.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-content-tertiary">No webhooks configured.</p>
        )}

        <h3 className="text-lg font-semibold text-content-accent">
          Add Webhook
        </h3>
        <form className="space-y-4" onSubmit={handleWebhookSubmit}>
          <input
            type="text"
            placeholder="Webhook URL"
            className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Webhook Secret"
            required={false}
            className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
          >
            Add Webhook
          </button>
        </form>
      </div>

      {/* posts */}
      <div className="bg-surface-secondary rounded-lg shadow-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold text-content-accent">Posts</h2>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-content-accent">Replies</h3>
          {thread.posts && thread.posts.length > 0 ? (
            <ul className="space-y-4">
              {thread.posts.map((post) => (
                <li
                  key={post.id}
                  className="bg-surface-tertiary p-4 rounded-lg"
                >
                  <div>{post.author}</div>
                  <div>{post.time}</div>
                  {post.image && (
                    <img
                      src={post.image}
                      alt="Post Image"
                      className="w-full rounded-lg mb-4 max-w-xs"
                    />
                  )}

                  <div>{post.text}</div>
                  <button
                    className="text-xs text-content-accent hover:underline"
                    onClick={(e) => handlePostDelete(e, post.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-content-tertiary">No replies yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PostComposer() {
  const fetcher = useFetcher<{ success: boolean }>();
  const [postContent, setPostContent] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    fetcher.submit(
      {
        intent: "createPost",
        content: postContent,
      },
      { method: "post" }
    );
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      setPostContent("");
    }
  }, [fetcher.data]);

  return (
    <div className="bg-surface-secondary rounded-lg shadow-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-content-accent">New Post</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          placeholder="Write your reply..."
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          className="w-full px-4 py-2 h-32 bg-surface-tertiary border border-border rounded-lg resize-none focus:ring-2 focus:ring-border-focus focus:border-transparent"
        />
        <button
          type="submit"
          className="w-full px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
        >
          Post Reply
        </button>
      </form>
    </div>
  );
}

function DocumentPanel() {
  return (
    <div className="w-80 h-[calc(100vh-64px)] bg-surface-secondary border-l border-border p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-content-accent mb-4">
        Documents
      </h2>
      <p className="text-content-tertiary">Document Panel (stub)</p>
    </div>
  );
}
