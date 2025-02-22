import React, { useState, useEffect, Suspense } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher, Await } from "@remix-run/react";
import { clientMiddleware } from "~/middleware/storageClient";
import type {
  Thread,
  BackendConnection,
  Document as TDocument,
  APIKey,
  Webhook,
} from "~/clients/types";
import SettingsModal from "~/components/SettingsModal";
import { RestThreadClient } from "~/clients/rest";

type LoaderData = {
  threads: Thread[];
  servers: string[];
  backendMetadata: BackendConnection[];
  activeThread: Thread | null;
  activeThreadWebhooks: Promise<Webhook[]>;
  activeThreadDocuments: Promise<TDocument[]>;
  activeThreadApiKeys: Promise<APIKey[]>;
  initialViewConfig: {
    showSettings: boolean;
    showMenu: boolean;
  };
};

export const loader: LoaderFunction = async ({ request, context }) => {
  const threads: Array<Thread> = [];
  let activeThread = null;
  let activeThreadWebhooks = Promise.resolve<Webhook[]>([]);
  let activeThreadDocuments = Promise.resolve<TDocument[]>([]);
  let activeThreadApiKeys = Promise.resolve<APIKey[]>([]);

  const url = new URL(request.url);
  const threadId = url.searchParams.get("t");
  const server = url.searchParams.get("s");

  // inplace update the clientMiddleware
  await clientMiddleware(request, context);
  const storageClients = context.storageClients;
  const backendsJson = context.backendsJson;
  const apiKeysJson = context.apiKeysJson;

  if (!backendsJson || !apiKeysJson) {
    return new Response(null, { status: 500 });
  }

  const backendMetadata = backendsJson.map((backend) => {
    const { id, name, url, token, isActive } = backend;
    return { id, name, url, token: token, isActive };
  });

  // if storageClients not in context, return empty threads
  if (!storageClients) {
    return Response.json({ threads, activeThread }, { status: 200 });
  }

  const servers = Object.keys(storageClients);

  // we only use a single route but this can be expanded
  let allowedRoutes = ["/", "/other"];

  if (server && !servers.includes(server)) {
    const token = url.searchParams.get("token");

    if (token) {
      const adHocServer = new RestThreadClient(server);
      adHocServer.setNarrowToken(token);
      context.storageClients[server] = adHocServer;

      // based on the ALC from the server, we can restrict the routes
      allowedRoutes = ["/"];
    }
  }

  // if the route is not allowed, return an error
  if (!allowedRoutes.includes(url.pathname)) {
    const data: LoaderData = {
      threads: threads,
      activeThread: null,
      servers,
      backendMetadata,
      activeThreadWebhooks,
      activeThreadDocuments,
    };

    return data;
  }

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

  if (threadId && server && activeThread === null) {
    try {
      const activeThreadStartTimestamp = Date.now();
      activeThread = await context.storageClients[server].getThread(
        parseInt(threadId)
      );

      if (activeThread && activeThread.posts) {
        activeThread.posts.sort((a, b) => b.id - a.id);
        activeThread.location = server;

        activeThreadWebhooks = context.storageClients[server].getThreadWebhooks(
          parseInt(threadId)
        );
        activeThreadDocuments = context.storageClients[
          server
        ].getThreadDocuments(parseInt(threadId));

        activeThreadApiKeys = context.storageClients[server].getThreadApiKeys(
          parseInt(threadId)
        );
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

  const initialViewConfig = {
    showSettings: false,
    showMenu: false,
  };

  const data: LoaderData = {
    threads: threads,
    activeThread,
    servers,
    backendMetadata,
    activeThreadWebhooks,
    activeThreadDocuments,
    activeThreadApiKeys,
    initialViewConfig,
  };

  return data;
};

export const action: ActionFunction = async ({ request, context }) => {
  // inplace update the clientMiddleware
  await clientMiddleware(request, context);

  const url = new URL(request.url);
  const servers = Object.keys(context.storageClients);
  const server = url.searchParams.get("s");
  const threadId = url.searchParams.get("t");

  // by default actions are allowed
  let allowedActions = [
    "createThread",
    "createPost",
    "updateSettings",
    "createWebhook",
    "removeWebhook",
    "createDocument",
    "deleteDocument",
    "deleteThread",
    "deletePost",
    "shareUrlCreate",
    "createApiKey",
    "deleteApiKey",
    "getApiKeys",
  ];

  if (server && !servers.includes(server)) {
    const token = url.searchParams.get("token");
    if (token) {
      const adHocServer = new RestThreadClient(server);
      adHocServer.setNarrowToken(token);
      context.storageClients[server] = adHocServer;

      // TODO: revisit limiting acls but move into server

      // based on the ALC from the server, we can restrict the actions
      // allowedActions = ["createPost", "deletePost", "shareUrlCreate"];
    }
  }

  // get the headers from the request
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!intent) {
    return new Response(null, { status: 400 });
  }

  // if the intent is not allowed, return a 400
  if (!allowedActions.includes(intent)) {
    return new Response(null, { status: 400 });
  }

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

    const storageClient = context.storageClients[server];
    if (!storageClient) {
      return new Response(null, { status: 400 });
    }

    // create the post in the selected server
    const _newPost = await storageClient.createPost(parseInt(threadId), {
      text: content,
    });

    const data: { success: boolean } = { success: true };
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response;
  } else if (intent === "updateSettings") {
    const jsonStringBackends = formData.getAll("backends");
    const jsonStringApiKeys = formData.getAll("apiKeys");
    if (!jsonStringBackends) {
      return new Response(null, { status: 400 });
    }
    const apiKeys = JSON.parse(String(jsonStringApiKeys));
    const backends = JSON.parse(String(jsonStringBackends));

    // serialize and base64 encode the backends
    // const serverData = btoa(JSON.stringify(backends));
    const serverData = JSON.stringify(backends);
    const apiKeyData = JSON.stringify(apiKeys);

    // update the cookies so we can use the new servers
    const backendCookieOptions = [
      `backends=${serverData}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=31536000",
    ];
    const apiKeyCookieOptions = [
      `apiKeys=${apiKeyData}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=31536000",
    ];

    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    // Append each cookie as its own header.
    headers.append("Set-Cookie", backendCookieOptions.join("; "));
    headers.append("Set-Cookie", apiKeyCookieOptions.join("; "));

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), { headers });
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
  } else if (intent == "shareUrlCreate") {
    // TODO
    const preimage = String(formData.get("preimage"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!url) {
      return new Response(null, { status: 400 });
    }

    // get current thread
    const thread = await context.storageClients[server].getThread(
      parseInt(threadId)
    );

    if (!thread) {
      return new Response(null, { status: 400 });
    }

    const updatedThread = await context.storageClients[server].updateThread(
      parseInt(threadId),
      {
        title: thread.title,
        sharePubkey: preimage,
      }
    );

    const data: { success: boolean } = { success: true };

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "createApiKey") {
    const name = String(formData.get("name"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!name) {
      return new Response(null, { status: 400 });
    }

    const _newApiKey = await context.storageClients[server].createAPIKey(
      Number(threadId),
      name,
      {
        read: true,
        write: true,
        delete: true,
      }
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

const buf2hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Create a unique ephemeral value and its hash commitment.
async function createEphemeralHash() {
  const timestamp = new Date().getTime();
  // Create a random 8-byte nonce
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const nonceHex = Array.from(nonce)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Preimage: unique ephemeral value
  const noncePreimage = crypto.getRandomValues(new Uint8Array(20));
  const noncePreimageHex = Array.from(noncePreimage)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const preimage = noncePreimageHex;

  const data = new TextEncoder().encode(preimage);
  // Compute the SHA-256 hash of the preimage.
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = buf2hex(hashBuffer);

  return { hash: hashHex, preimage };
}

// Verify that the provided preimage hashes to the shared commitment.
// async function verifyEphemeralHash(preimage, expectedHash) {
async function verifyEphemeralHash(preimage: string, expectedHash: string) {
  const data = new TextEncoder().encode(preimage);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const computedHash = buf2hex(hashBuffer);
  const valid = computedHash === expectedHash;
  return valid;
}

async function creatEphemeralPubKeySignature() {
  const { hash, preimage } = await createEphemeralHash();
  return { hash, preimage };
}

export default function Index() {
  const {
    threads,
    activeThread,
    servers,
    backendMetadata,
    activeThreadWebhooks,
    activeThreadDocuments,
    activeThreadApiKeys,
    initialViewConfig,
  } = useLoaderData<LoaderData>();

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

  const [showSettings, setShowSettings] = useState(
    initialViewConfig.showSettings
  );
  const [showMenu, setShowMenu] = useState(initialViewConfig.showMenu);

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
      // TODO: determine when to actually remove the t and s params

      // url.searchParams.delete("t");
      // url.searchParams.delete("s");
      // window.history.pushState({}, "", url);
    }

    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary">
      <Topbar
        openSettings={() => setShowSettings(true)}
        toggleOpenMenu={() => setShowMenu(!showMenu)}
      />
      <div className="flex">
        <Sidebar
          servers={servers}
          threads={threads}
          setActiveThread={setActiveThread}
          activeThread={activeThread}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
        />
        <MainContent
          activeThread={activeThread}
          activeThreadWebhooks={activeThreadWebhooks}
          activeThreadDocuments={activeThreadDocuments}
          activeThreadApiKeys={activeThreadApiKeys}
        />
        {/* <DocumentPanel /> */}
      </div>
      {showSettings && (
        <SettingsModal
          backendMetadata={backendMetadata}
          activeThreadApiKeys={activeThreadApiKeys}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function Topbar({
  openSettings,
  toggleOpenMenu,
}: {
  openSettings: () => void;
  toggleOpenMenu?: (setIsOpen: (isOpen: boolean) => void) => void;
}) {
  return (
    <header className="h-16 bg-surface-secondary border-b border-border shadow-lg flex justify-between items-center px-6">
      <div className="flex items-center">
        {toggleOpenMenu && (
          <button
            onClick={() => toggleOpenMenu((isOpen) => !isOpen)}
            className="lg:hidden mr-4"
          >
            <MenuIcon />
          </button>
        )}
        <h1 className="text-xl font-bold text-content-accent">Threads</h1>
      </div>
      <button
        onClick={openSettings}
        className="text-content-accent hover:underline"
      >
        Settings
      </button>
    </header>
  );
}

const MenuIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

function Sidebar({
  servers,
  threads,
  setActiveThread,
  activeThread,
  showMenu,
  setShowMenu,
}: {
  servers: string[];
  threads: Thread[];
  setActiveThread: (thread: Thread | null) => void;
  activeThread: Thread | null;
  showMenu: boolean;
  setShowMenu: (showMenu: boolean) => void;
}) {
  // const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Handle window resize and set mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar when a thread is selected on mobile
  useEffect(() => {
    if (isMobile && activeThread) {
      setShowMenu(false);
    }
  }, [activeThread, isMobile]);

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && showMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative top-16
          w-80 h-[calc(100vh-64px)]
          bg-surface-secondary
          border-r border-border
          overflow-y-auto
          transition-transform duration-300 ease-in-out
          z-30 lg:z-auto
          lg:top-0 left-0
          ${showMenu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-6 space-y-6">
          <ThreadComposer servers={servers} />
          <ThreadList
            threads={threads}
            setActiveThread={setActiveThread}
            activeThread={activeThread}
          />
        </div>
      </aside>
    </>
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
            <button
              className="text-xs text-content-accent float-right mt-1"
              onClick={handleThreadDelete}
            >
              <CloseIcon />
            </button>
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

function ThreadSettingView({
  activeThreadWebhooks,
}: {
  activeThreadWebhooks: Promise<Webhook[]>;
}) {
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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-content-accent">Settings</h2>

      <div className="bg-surface-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-content-accent mb-2">
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

      <div>
        <h3 className="text-lg font-semibold text-content-accent mb-2">
          Webhooks
        </h3>
        <Suspense
          fallback={
            // a skeleton loader
            <div className="space-y-4">
              <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
              <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
              <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
            </div>
          }
        >
          <Await resolve={activeThreadWebhooks}>
            {(webhooks) => (
              <ul className="space-y-4">
                {webhooks &&
                  webhooks.map((webhook, idx) => (
                    <li
                      key={webhook.id}
                      className="bg-surface-tertiary p-4 rounded-lg"
                    >
                      <button
                        className="text-xs text-content-accent float-right mt-1"
                        onClick={(e) => handleWebhookRemove(e, webhook.id)}
                      >
                        <CloseIcon />
                      </button>
                      <div>{webhook.url}</div>
                      <div>{webhook.secret}</div>
                    </li>
                  ))}
              </ul>
            )}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}

function MainContent({
  activeThread,
  activeThreadWebhooks,
  activeThreadDocuments,
  activeThreadApiKeys,
}: {
  activeThread: Thread | null;
  activeThreadWebhooks: Promise<Webhook[]>;
  activeThreadDocuments: Promise<TDocument[]>;
  activeThreadApiKeys: Promise<APIKey[]>;
}) {
  enum Tab {
    Posts = "posts",
    Webhooks = "webhooks",
    Documents = "documents",
    Access = "access",
  }

  const [currentTab, setCurrentTab] = useState(Tab.Posts);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const fetcher = useFetcher<{ success: boolean }>();

  const handleTabChange = (tab: Tab) => {
    setCurrentTab(tab);
  };

  const handleShareUrlCreate = async () => {
    // only allow calling if there is no share_pubkey
    if (activeThread && activeThread.share_pubkey) return;

    const { hash, preimage } = await creatEphemeralPubKeySignature();

    fetcher.submit(
      {
        intent: "shareUrlCreate",
        preimage,
      },
      { method: "post" }
    );

    const urlValues = {
      t: "5",
      s: "http://localhost:8787",
      token: hash,
    };

    // use the current URL
    const url = new URL(window.location.toString());
    for (const key in urlValues) {
      url.searchParams.set(key, urlValues[key]);
    }

    setShareUrl(url.toString());
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

  const [counts, setCounts] = useState({
    posts: 0,
    settings: 0,
    documents: 0,
    access: 0,
  });

  const [url, setUrl] = useState("");

  useEffect(() => {
    activeThread?.posts &&
      setCounts((prev) => ({ ...prev, posts: activeThread.posts.length }));

    activeThreadWebhooks.then((webhooks) => {
      setCounts((prev) => ({ ...prev, settings: webhooks.length }));
    });
    activeThreadDocuments.then((documents) => {
      setCounts((prev) => ({ ...prev, documents: documents.length }));
    });
    activeThreadApiKeys.then((apiKeys) => {
      setCounts((prev) => ({ ...prev, access: apiKeys.length }));
    });

    // if window.location.origin is available, use it
    if (window.location.origin && activeThread) {
      const currentUrl = window.location.origin;
      const shareUrl = `${currentUrl}/?t=${activeThread.id}&s=${activeThread.location}&token=${activeThread.share_pubkey}`;
      setUrl(shareUrl);
    }

    // cleanup
    return () => {
      setCounts({ posts: 0, settings: 0, documents: 0, access: 0 });
    };
  }, [activeThreadWebhooks, activeThreadDocuments]);

  const handleApiKeySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form[0].value;
    if (!name) return;

    fetcher.submit(
      {
        intent: "createApiKey",
        name,
      },
      { method: "post" }
    );
  };

  // API key related
  const updateAPIKey = (updated: APIKey) => {
    fetcher.submit(
      {
        intent: "updated",
        updated: JSON.stringify(updated),
      },
      { method: "post" }
    );
  };

  const removeAPIKey = (id: string) => {
    fetcher.submit(
      {
        intent: "removeApiKey",
        id,
      },
      { method: "post" }
    );
  };

  return (
    <main className="flex-1 h-[calc(100vh-64px)] overflow-y-auto bg-surface-primary p-6">
      {activeThread ? (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-content-accent">
              {activeThread.title}
            </h2>
            <div className="">
              <h3 className="text-lg font-semibold text-content-accent mb-2">
                Share URL
              </h3>
              <div className="flex items-center space-x-4">
                <div className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent min-h-10 truncate">
                  {activeThread && activeThread.share_pubkey && url && url}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
                  className="px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <p className="text-content-secondary">
              {activeThread.last_activity}
            </p>
          </div>

          <div className="flex space-x-4 overflow-x-auto pb-4">
            <button
              onClick={() => handleTabChange(Tab.Posts)}
              className={`${
                currentTab === "posts"
                  ? "bg-interactive text-content-primary"
                  : "bg-surface-tertiary text-content-accent"
              } px-6 py-2 rounded-lg font-medium`}
            >
              Posts
              <span className="ml-2 text-xs text-content-secondary">
                ({counts.posts})
              </span>
            </button>
            <button
              onClick={() => handleTabChange(Tab.Webhooks)}
              className={`${
                currentTab === "webhooks"
                  ? "bg-interactive text-content-primary"
                  : "bg-surface-tertiary text-content-accent"
              } px-6 py-2 rounded-lg font-medium`}
            >
              Webhooks
              <span className="ml-2 text-xs text-content-secondary">
                ({counts.settings})
              </span>
            </button>
            <button
              onClick={() => handleTabChange(Tab.Documents)}
              className={`${
                currentTab === "documents"
                  ? "bg-interactive text-content-primary"
                  : "bg-surface-tertiary text-content-accent"
              } px-6 py-2 rounded-lg font-medium`}
            >
              Documents
              <span className="ml-2 text-xs text-content-secondary">
                ({counts.documents})
              </span>
            </button>
            <button
              onClick={() => handleTabChange(Tab.Access)}
              className={`${
                currentTab === "access"
                  ? "bg-interactive text-content-primary"
                  : "bg-surface-tertiary text-content-accent"
              } px-6 py-2 rounded-lg font-medium`}
            >
              Access
              <span className="ml-2 text-xs text-content-secondary">
                ({counts.access})
              </span>
            </button>
            <button
              onClick={handleShareUrlCreate}
              className={`${
                currentTab === "never"
                  ? "bg-interactive text-content-primary"
                  : "bg-surface-tertiary text-content-accent"
              } px-6 py-2 rounded-lg font-medium`}
            >
              Share URL
            </button>
          </div>

          {currentTab === "posts" && (
            <div>
              <PostComposer />
              <Thread
                thread={activeThread}
                activeThreadWebhooks={activeThreadWebhooks}
                activeThreadDocuments={activeThreadDocuments}
              />
            </div>
          )}
          {currentTab === "webhooks" && (
            <ThreadSettingView activeThreadWebhooks={activeThreadWebhooks} />
          )}
          {currentTab === "documents" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-content-accent">
                Documents
              </h2>

              <div className="bg-surface-secondary rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-content-accent mb-2">
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

              <div>
                <Suspense
                  fallback={
                    // a skeleton loader
                    <div className="space-y-4">
                      <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
                      <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
                      <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
                    </div>
                  }
                >
                  <Await resolve={activeThreadDocuments}>
                    {(documents) => (
                      <ul className="space-y-4">
                        {documents &&
                          documents.map((document, idx) => (
                            <li
                              key={document.id}
                              className="bg-surface-tertiary p-4 rounded-lg"
                            >
                              <button
                                className="text-xs text-content-accent float-right mt-1"
                                onClick={(e) =>
                                  handleDocumentRemove(e, document.id)
                                }
                              >
                                <CloseIcon />
                              </button>
                              <div>{document.title}</div>
                              <div>{document.content}</div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </Await>
                </Suspense>
              </div>
            </div>
          )}
          {currentTab === "access" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-content-accent">
                Access
              </h2>

              <div className="bg-surface-secondary rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-content-accent mb-2">
                  Add Document
                </h3>
                <form className="space-y-4" onSubmit={handleApiKeySubmit}>
                  <input
                    type="text"
                    placeholder="API Key Name"
                    className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="border border-border px-4 py-2 rounded bg-green-600 text-content-accent hover:bg-green-700"
                  >
                    Create New API Key
                  </button>
                </form>
              </div>

              <div>
                <Suspense
                  fallback={
                    // a skeleton loader
                    <div className="space-y-4">
                      <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
                      <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
                      <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
                    </div>
                  }
                >
                  <Await resolve={activeThreadApiKeys}>
                    {(apikey) => {
                      return (
                        <div>
                          <h2 className="text-lg font-semibold text-content-accent mb-4">
                            Active Thread API Keys
                          </h2>
                          {apikey.map((key) => (
                            <APIKeyItem
                              key={key.id}
                              apiKey={{
                                id: key.id,
                                key_name: key.key_name,
                                api_key: key.api_key,
                                permissions: {
                                  read: true,
                                  write: true,
                                  delete: true,
                                },
                              }}
                              onUpdate={updateAPIKey}
                              onRemove={removeAPIKey}
                            />
                          ))}
                        </div>
                      );
                    }}
                  </Await>
                </Suspense>
              </div>
            </div>
          )}
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
    }
  }, [fetcher.data]);

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-lg font-semibold text-content-accent">Posts</h2>
      <div className="space-y-4">
        {thread.posts && thread.posts.length > 0 ? (
          <ul className="space-y-4">
            {thread.posts.map((post) => (
              <li key={post.id} className="bg-surface-tertiary p-4 rounded-lg">
                <button
                  className="text-xs text-content-accent float-right mt-1"
                  onClick={(e) => handlePostDelete(e, post.id)}
                >
                  <CloseIcon />
                </button>
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
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-content-accent">New Post</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
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

// TODO: consolidate styles of various lists based on similar interactions
function APIKeyItem({
  apiKey,
  onUpdate,
  onRemove,
}: {
  apiKey: APIKey;
  onUpdate: (updated: APIKey) => void;
  onRemove: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<APIKey>(apiKey);

  useEffect(() => {
    if (!isEditing) {
      setEditingData(apiKey);
    }
  }, [apiKey, isEditing]);

  const handleKeyChange = (value: string) => {
    setEditingData((prev) => ({ ...prev, key: value }));
  };

  const handleCheckboxChange = (
    perm: keyof APIKey["permissions"],
    value: boolean
  ) => {
    setEditingData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [perm]: value },
    }));
  };

  const handleSave = () => {
    onUpdate(editingData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingData(apiKey);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="border border-border p-4 rounded-lg mb-1 mt-1">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold">{apiKey.key_name || "New API Key"}</p>
            <p className="font-semibold">{apiKey.api_key || "New API Key"}</p>
            <div className="flex space-x-2 text-sm">
              {apiKey.permissions.read && <span>Read</span>}
              {apiKey.permissions.write && <span>Write</span>}
              {apiKey.permissions.delete && <span>Delete</span>}
            </div>
          </div>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onRemove(apiKey.id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border p-4 rounded-lg mb-4">
      <div className="mb-4">
        <label className="block text-sm font-medium">API Key</label>
        <input
          type="text"
          value={editingData.key_name}
          onChange={(e) => handleKeyChange(e.target.value)}
          className="bg-surface-tertiary mt-1 w-full border border-border rounded p-2"
          placeholder="Enter API key"
        />
      </div>
      <div className="mb-4">
        <span className="block text-sm font-medium">Permissions</span>
        <div className="flex items-center space-x-4 mt-1">
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={editingData.permissions.read}
              onChange={(e) => handleCheckboxChange("read", e.target.checked)}
            />
            <span className="text-sm">Read</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={editingData.permissions.write}
              onChange={(e) => handleCheckboxChange("write", e.target.checked)}
            />
            <span className="text-sm">Write</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={editingData.permissions.delete}
              onChange={(e) => handleCheckboxChange("delete", e.target.checked)}
            />
            <span className="text-sm">Delete</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded bg-gray-300 text-black hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded bg-blue-500 text-content-accent hover:bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  );
}
