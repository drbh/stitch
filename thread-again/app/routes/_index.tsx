import React, { useState, useEffect } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { clientMiddleware } from "~/middleware/storageClient";
import type { Thread } from "~/clients/types";

type LoaderData = {
  threads: Thread[];
  activeThread: Thread | null;
  servers: string[];
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

  // if storageClients not in context, return empty threads
  if (!storageClients) {
    return Response.json({ threads, activeThread }, { status: 200 });
  }

  const servers = Object.keys(storageClients);
  for (const server of servers) {
    const serverThreads = await storageClients[server].getThreads();
    serverThreads.forEach((thread) => {
      thread.location = server;
    });
    threads.push(...serverThreads);
  }

  if (threadId && server) {
    activeThread = await context.storageClients[server].getThread(
      parseInt(threadId)
    );

    if (activeThread && activeThread.posts) {
      activeThread.posts.sort((a, b) => b.id - a.id);
      activeThread.location = server;
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

  const data: LoaderData = {
    threads: threads,
    activeThread,
    servers,
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
    const newThread = await context.storageClients[location].createThread({
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
  } else if (intent === "updateServers") {
    const servers = formData.get("servers");

    // update the cookies so we can use the new servers
    const cookieOptions = [
      `servers=${servers}`,
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
  } else if (intent === "createPost") {
    const content = String(formData.get("content"));
    const url = new URL(request.url);
    const threadId = String(url.searchParams.get("t"));
    const server = String(url.searchParams.get("s"));

    // create the post in the selected server
    const newPost = await context.storageClients[server].createPost(
      parseInt(threadId),
      { text: content }
    );

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
  const { threads, activeThread, servers } = useLoaderData<LoaderData>();

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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
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
  return (
    <div className="bg-surface-secondary rounded-lg shadow-lg p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-content-accent">
          {thread.title}
        </h2>
        <p className="text-content-secondary">{thread.last_activity}</p>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-content-accent">Replies</h3>
        {thread.posts && thread.posts.length > 0 ? (
          <ul className="space-y-4">
            {thread.posts.map((post) => (
              <li key={post.id} className="bg-surface-tertiary p-4 rounded-lg">
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
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-content-tertiary">No replies yet.</p>
        )}
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
      <h2 className="text-lg font-semibold text-content-accent">Add a Reply</h2>
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

function SettingsModal({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher<{ success: boolean }>();
  const [servers, setServers] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "updateServers",
        servers,
      },
      { method: "post" }
    );
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      onClose();
    }
  }, [fetcher.data, servers, onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg- opacity-50" onClick={onClose}></div>
      <div className="bg-surface-secondary p-6 rounded-lg shadow-lg z-10 w-96">
        <h2 className="text-xl font-bold mb-4">Settings</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">
              Servers (comma separated)
            </label>
            <small className="text-xs text-content-tertiary">
              Example: local,http://localhost:8000
            </small>
            <input
              type="text"
              name="servers"
              value={servers}
              onChange={(e) => setServers(e.target.value)}
              className="mt-2 w-full border border-border rounded p-2 bg-surface-tertiary"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-500 text-white"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
