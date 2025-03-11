import React, { useState, useEffect, Suspense, useRef } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher, Await } from "@remix-run/react";
import { clientMiddleware } from "~/middleware/storageClient";
import type {
  Thread,
  BackendConnection,
  Document as TDocument,
  APIKey,
  Webhook,
  Post,
} from "~/clients/types";
import SettingsModal from "~/components/SettingsModal";
import { RestThreadClient } from "~/clients/rest";

type LoaderData = {
  threads: Promise<Thread[]>;
  servers: string[];
  backendMetadata: BackendConnection[];
  activeThread: Thread | null;
  activeThreadWebhooks: Promise<Webhook[]>;
  activeThreadDocuments: Promise<TDocument[]>;
  activeThreadApiKeys: Promise<APIKey[]>;
  activeThreadPosts: Promise<Post[]>;
  initialViewConfig: {
    isShareUrl: boolean;
    showSettings: boolean;
    showMenu: boolean;
  };
};

export const loader: LoaderFunction = async ({ request, context }) => {
  const overallStart = Date.now();
  console.log(
    `[TRACE] Loader started at ${new Date(overallStart).toISOString()}`
  );

  const url = new URL(request.url);
  const threadId = url.searchParams.get("t");
  const server = url.searchParams.get("s");

  // Measure the clientMiddleware call.
  const middlewareStart = Date.now();
  await clientMiddleware(request, context);
  console.log(
    `[TRACE] clientMiddleware took ${Date.now() - middlewareStart}ms`
  );

  if (url.searchParams.has("addBackend")) {
    const newBackend = url.searchParams.get("addBackend");
    const backendsJson = context.backendsJson;
    if (backendsJson) {
      const newBackendsJsonSerialized = JSON.parse(atob(newBackend));
      newBackendsJsonSerialized.id = backendsJson.length + 1;

      // make sure the backend is not already in the list
      const exists = backendsJson.find(
        (b) => b.url === newBackendsJsonSerialized.url
      );
      if (exists) {
        console.log(`[TRACE] Backend already exists: ${newBackend}`);
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }

      backendsJson.push(newBackendsJsonSerialized);
      const newBackendsJson = JSON.stringify(backendsJson);
      const backendCookieOptions = [
        `backends=${newBackendsJson}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Max-Age=31536000",
      ];
      const headers = new Headers();
      headers.append("Set-Cookie", backendCookieOptions.join("; "));
      headers.append("Location", "/");
      console.log(`[TRACE] Added new backend: ${newBackend}`);
      return new Response(null, {
        headers,
        status: 302,
      });
    }
  }

  let activeThread = null;
  let threads = Promise.resolve<Thread[]>([]);
  let activeThreadWebhooks = Promise.resolve<Webhook[]>([]);
  let activeThreadDocuments = Promise.resolve<TDocument[]>([]);
  let activeThreadApiKeys = Promise.resolve<APIKey[]>([]);
  let activeThreadPosts = Promise.resolve<Post[]>([]);
  let isShareUrl = false;

  const storageClients = context.storageClients;
  const backendsJson = context.backendsJson;
  const apiKeysJson = context.apiKeysJson;

  if (!backendsJson || !apiKeysJson) {
    console.log(
      `[TRACE] Missing backendsJson or apiKeysJson, returning error.`
    );
    return new Response(null, { status: 500 });
  }

  // Time the mapping of backend metadata.
  const backendMappingStart = Date.now();
  const backendMetadata = backendsJson.map((backend) => {
    const { id, name, url, token, isActive } = backend;
    return { id, name, url, token, isActive };
  });
  console.log(
    `[TRACE] Mapping backendMetadata took ${Date.now() - backendMappingStart}ms`
  );

  // If storageClients not in context, return empty threads.
  if (!storageClients) {
    console.log(`[TRACE] No storageClients, returning empty threads.`);
    return Response.json({ threads, activeThread }, { status: 200 });
  }

  const servers = Object.keys(storageClients);
  console.log(`[TRACE] Servers available: ${servers.join(", ")}`);

  // Determine allowed routes.
  let allowedRoutes = ["/", "/other"];
  if (server && !servers.includes(server)) {
    const token = url.searchParams.get("token");
    if (token) {
      const adHocServer = new RestThreadClient(server);
      adHocServer.setNarrowToken(token);
      context.storageClients[server] = adHocServer;
      isShareUrl = true;
      allowedRoutes = ["/"];
      console.log(
        `[TRACE] AdHoc server added for ${server}. Allowed routes set to ${allowedRoutes.join(
          ", "
        )}`
      );
    }
  }

  // If the route is not allowed, return error data.
  if (!allowedRoutes.includes(url.pathname)) {
    console.log(
      `[TRACE] Route ${url.pathname} is not allowed. Returning error data.`
    );
    const data: LoaderData = {
      threads,
      activeThread,
      servers,
      backendMetadata,
      activeThreadWebhooks,
      activeThreadDocuments,
      activeThreadApiKeys,
      activeThreadPosts,
      initialViewConfig: {
        isShareUrl: false,
        showSettings: false,
        showMenu: false,
      },
    };
    return data;
  }

  const multiThreadPromise = [];
  // Loop through servers and fetch threads.
  for (const srv of servers) {
    try {
      const serverStart = Date.now();
      const serverThreads = storageClients[srv]
        .getThreads()
        .then((threads) => threads)
        .catch(() => {
          console.error(`[TRACE] Error fetching threads from ${srv}`);
          return [];
        });
      console.log(
        `[TRACE] getThreads for server "${srv}" took ${
          Date.now() - serverStart
        }ms`
      );
      serverThreads
        .then((serverThreads) => {
          serverThreads.forEach((thread) => {
            thread.location = srv;
          });
          return serverThreads;
        })
        .catch(() => []);
      multiThreadPromise.push(serverThreads);
    } catch (error) {
      console.error(
        `[TRACE] Error fetching threads from ${srv}: ${error.message}`
      );
    }
  }
  threads = Promise.all(multiThreadPromise).then((threadList) => {
    return threadList.flat();
  });

  // If a specific thread is requested, fetch it and its related data.
  if (threadId && server && activeThread === null) {
    try {
      const activeThreadStart = Date.now();
      activeThread = await context.storageClients[server].getThread(
        parseInt(threadId)
      );
      console.log(
        `[TRACE] getThread for threadId "${threadId}" on server "${server}" took ${
          Date.now() - activeThreadStart
        }ms`
      );

      if (activeThread && activeThread.posts) {
        activeThread.location = server;

        // Start parallel fetching for webhooks, documents, and API keys.
        const parallelStart = Date.now();
        activeThreadWebhooks = context.storageClients[server]
          .getThreadWebhooks(parseInt(threadId))
          .then((webhooks) => webhooks)
          .catch(() => []);

        activeThreadDocuments = context.storageClients[server]
          .getThreadDocuments(parseInt(threadId))
          .then((documents) => documents)
          .catch(() => []);

        activeThreadApiKeys = context.storageClients[server]
          .getThreadApiKeys(parseInt(threadId))
          .then((apiKeys) => apiKeys)
          .catch(() => []);

        activeThreadPosts = context.storageClients[server]
          .getLatestPosts(parseInt(threadId), 10)
          .then((posts) => posts)
          .catch(() => []);
      }
    } catch (error) {
      console.error(`[TRACE] Error fetching active thread: ${error.message}`);
      activeThread = null;
    }
  }

  // Trace the cookie string generation.
  const cookieStart = Date.now();
  const cookieOptions = [
    `last_visited=${new Date().toISOString()}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=31536000",
  ];
  console.log(
    `[TRACE] Setting cookieOptions took ${Date.now() - cookieStart}ms`
  );

  const initialViewConfig = {
    isShareUrl,
    showSettings: false,
    showMenu: false,
  };

  const data: LoaderData = {
    threads,
    activeThread,
    servers,
    backendMetadata,
    activeThreadWebhooks,
    activeThreadDocuments,
    activeThreadApiKeys,
    initialViewConfig,
    activeThreadPosts,
  };

  console.log(`[TRACE] Loader finished in ${Date.now() - overallStart}ms`);

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
    console.log(`[TRACE] WRN Action not allowed: ${intent}`);
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
    const selectedImage = formData.get("file");
    const selectedImageFile = selectedImage as File;

    const storageClient = context.storageClients[server];
    if (!storageClient) {
      return new Response(null, { status: 400 });
    }

    // create the post in the selected server
    const _newPost = await storageClient.createPost(parseInt(threadId), {
      text: content,
      image: selectedImageFile,
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
    activeThreadPosts,
  } = useLoaderData<LoaderData>();

  // updapte showSettings to be true if there are no backends and were not shared
  if (backendMetadata.length === 0 && !initialViewConfig.isShareUrl) {
    initialViewConfig.showSettings = true;
  }

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
      if (activeThread.id) {
        url.searchParams.set("t", String(activeThread.id));
        url.searchParams.set("s", String(activeThread.location));
        window.history.pushState({}, "", url);
      }
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
      {!initialViewConfig.isShareUrl && (
        <Topbar
          openSettings={() => setShowSettings(true)}
          toggleOpenMenu={() => setShowMenu(!showMenu)}
        />
      )}
      {initialViewConfig.isShareUrl && (
        <div className="h-16 bg-surface-tertiary border-b border-border shadow-lg flex justify-center items-center px-6">
          Note: You are viewing a shared thread. This is a read-only view.
        </div>
      )}
      <div className="flex">
        {/* TODO handle share */}
        {!initialViewConfig.isShareUrl && (
          <Sidebar
            servers={servers}
            threads={threads}
            setActiveThread={setActiveThread}
            activeThread={activeThread}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
          />
        )}
        <MainContent
          activeThread={activeThread}
          activeThreadPosts={activeThreadPosts}
          activeThreadWebhooks={activeThreadWebhooks}
          activeThreadDocuments={activeThreadDocuments}
          activeThreadApiKeys={activeThreadApiKeys}
          isShareUrl={initialViewConfig.isShareUrl}
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

      {/* Bottom bar */}
      <div className="absolute bottom-0 w-full bg-surface-secondary border-t border-border shadow-lg p-2">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            <button
              className="ml-2 text-sm text-gray-500 flex items-center gap-2"
              onClick={() => setShowSettings(true)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </button>
          </div>

          <div className="text-sm text-gray-500 text-end opacity-50">
            &copy; {new Date().getFullYear()} Stitch | Built with ❤️ by drbh |
            Version 0.0.1
          </div>
        </div>
      </div>
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
      <div className="flex items-center gap-2">
        {toggleOpenMenu && (
          <button
            onClick={() => toggleOpenMenu((isOpen) => !isOpen)}
            className="lg:hidden mr-2 p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              width="20"
              height="20"
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
          </button>
        )}

        <div className="flex items-center">
          <svg
            width="50"
            height="50"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-3"
          >
            <defs>
              <linearGradient
                id="threadGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <g
              fill="none"
              stroke="url(#threadGradient)"
              strokeWidth="16"
              strokeLinecap="round"
            >
              {/* Main thread line */}
              <path d="M50,30 C120,30 80,100 150,100" />
              <circle
                cx="50"
                cy="30"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />

              {/* essentially the above flipped */}
              <path d="M50,150 C100,220 120,100  150,100" />
              <circle
                cx="50"
                cy="150"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />
              <path d="M55,65 C90,65 90,5 150,100" />
              <circle
                cx="55"
                cy="65"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />
              <path d="M45,110 C80,60 60,160 150,100" />
              <circle
                cx="45"
                cy="110"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />

              {/* center node */}
              <circle
                cx="150"
                cy="100"
                r="20"
                fill="url(#threadGradient)"
                stroke="none"
              />
            </g>
          </svg>

          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-content-accent leading-none">
              Stitch
            </h1>
            <span className="text-xs text-gray-500 opacity-50">
              by stitch.sh
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            window.open(
              "https://github.com/drbh/thread",
              "_blank",
              "noopener,noreferrer"
            );
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-content-accent hover:bg-gray-100 rounded transition-colors"
          aria-label="GitHub"
        >
          <span>Star us on GitHub</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>
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
  threads: Promise<Thread[]>;
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
          bg-surface-primary
          fixed lg:relative top-16
          w-80 h-[calc(100vh-64px)]
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
  threads: Promise<Thread[]>;
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
        <Suspense
          fallback={
            // a skeleton loader
            <div className="space-y-4">
              <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
            </div>
          }
        >
          <Await resolve={threads}>
            {(threads) => (
              <>
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
              </>
            )}
          </Await>
        </Suspense>
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
  activeThreadPosts,
  activeThreadWebhooks,
  activeThreadDocuments,
  activeThreadApiKeys,
  isShareUrl,
}: {
  activeThread: Thread | null;
  activeThreadPosts: Promise<Post[]>;
  activeThreadWebhooks: Promise<Webhook[]>;
  activeThreadDocuments: Promise<TDocument[]>;
  activeThreadApiKeys: Promise<APIKey[]>;
  isShareUrl: boolean;
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
    activeThreadWebhooks.then((webhooks) => {
      setCounts((prev) => ({ ...prev, settings: webhooks.length }));
    });
    activeThreadDocuments.then((documents) => {
      setCounts((prev) => ({ ...prev, documents: documents.length }));
    });
    activeThreadApiKeys.then((apiKeys) => {
      setCounts((prev) => ({ ...prev, access: apiKeys.length }));
    });
    activeThreadPosts.then((posts) => {
      setCounts((prev) => ({ ...prev, posts: posts.length }));
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
            <div></div>
            {/* TODO handle share better */}
            {!isShareUrl && (
              <>
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
                  className="max-h-10 overflow-truncate truncate bg-surface-tertiary text-content-accent px-6 py-2 rounded-lg font-medium"
                >
                  Share URL
                </button>
              </>
            )}
          </div>

          {currentTab === "posts" && (
            <div>
              {!isShareUrl && <PostComposer />}
              <Thread
                thread={activeThread}
                isShareUrl={isShareUrl}
                activeThreadPosts={activeThreadPosts}
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

              {!isShareUrl && (
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
              )}

              <div>
                <Suspense
                  fallback={
                    // a skeleton loader
                    <div className="space-y-4">
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
                              {!isShareUrl && (
                                <button
                                  className="text-xs text-content-accent float-right mt-1"
                                  onClick={(e) =>
                                    handleDocumentRemove(e, document.id)
                                  }
                                >
                                  <CloseIcon />
                                </button>
                              )}
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

function Thread({
  thread,
  activeThreadPosts,
  isShareUrl,
}: {
  thread: Thread;
  activeThreadPosts: Promise<Post[]>;
  isShareUrl: boolean;
}) {
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
        <ul className="space-y-4">
          <Suspense
            fallback={
              // a skeleton loader
              <div className="space-y-4">
                <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
              </div>
            }
          >
            <Await resolve={activeThreadPosts}>
              {(posts) => (
                <ul className="space-y-4">
                  {posts.map((post) => (
                    <li
                      key={post.id}
                      className="bg-surface-tertiary p-4 rounded-lg"
                    >
                      {!isShareUrl && (
                        <button
                          className="text-xs text-content-accent float-right mt-1"
                          onClick={(e) => handlePostDelete(e, post.id)}
                        >
                          <CloseIcon />
                        </button>
                      )}
                      <div>{post.author}</div>
                      <div>{post.time}</div>
                      {post.image && (
                        <img
                          src={`${
                            thread.location === "local"
                              ? "./local"
                              : thread.location
                          }/api/${post.image}`}
                          alt="Post Image"
                          className="w-full rounded-lg mb-4 max-w-24"
                        />
                      )}

                      <div>{post.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Await>
          </Suspense>
        </ul>
      </div>
    </div>
  );
}

function PostComposer() {
  const fetcher = useFetcher<{ success: boolean }>();
  const [postContent, setPostContent] = useState("");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedImage(file);

      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    const formData = new FormData();
    if (selectedImage) {
      formData.append("file", selectedImage);
    }
    formData.append("intent", "createPost");
    formData.append("content", postContent);
    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
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

        {/* Image preview */}
        {imagePreview && (
          <div className="relative w-full">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-60 rounded-lg object-contain bg-surface-tertiary p-2"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-surface-secondary p-1 rounded-full"
              aria-label="Remove image"
            >
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
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Image upload button */}
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Upload image"
            />
            <button
              type="button"
              className="px-4 py-2 bg-surface-tertiary hover:bg-surface-tertiary-hover border border-border rounded-lg transition-colors flex items-center gap-2"
            >
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
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>Add Image</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className={`flex-1 px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors ${
              isUploading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isUploading ? "Uploading..." : "Post Reply"}
          </button>
        </div>
        {/*  */}
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
