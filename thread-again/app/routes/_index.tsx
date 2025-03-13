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
  LoaderData,
} from "~/clients/types";
import SettingsModal from "~/components/SettingsModal";
import { RestThreadClient } from "~/clients/rest";
import { getBuildHash } from "~/utils/build-hash.server";
import ThreadPostList from "~/components/ThreadPostList";
import Topbar from "~/components/Topbar";
import Sidebar from "~/components/Sidebar";
import APIKeyItem from "~/components/APIKeyItem";
import CloseIcon from "~/components/CloseIcon";

import _action from "~/service/actions";

export const action: ActionFunction = async ({ request, context }) => {
  return _action({ request, context });
};

export const loader: LoaderFunction = async ({ request, context }) => {
  const overallStart = Date.now();
  console.log(
    `[TRACE] Loader started at ${new Date(overallStart).toISOString()}`
  );

  const url = new URL(request.url);
  const threadId = url.searchParams.get("t");
  const server = url.searchParams.get("s");
  const buildHash = getBuildHash();

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
      // headers.append("Cache-Control", "no-store, max-age=0, must-revalidate");
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
      buildHash,
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
    buildHash,
  };

  console.log(`[TRACE] Loader finished in ${Date.now() - overallStart}ms`);

  return data;
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
    buildHash,
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
      <div className="fixed bottom-0 w-full bg-surface-secondary border-t border-border shadow-lg p-2">
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
            &copy; {new Date().getFullYear()} Stitch | Version {buildHash}
          </div>
        </div>
      </div>
    </div>
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
  const ref = React.createRef();

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

  const [isOpen, setIsOpen] = useState(false);
  const [stateMirror, setStateMirror] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    console.log("useEffect");
    if (ref.current && ref.current.states) {
      console.log("setting state mirror");
      setStateMirror(ref.current.states);
    }

    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest(".thread-actions-menu")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, ref.current]);

  return (
    <main className="flex-1 h-[calc(100vh-64px)] overflow-y-auto bg-surface-primary p-6">
      {activeThread ? (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-content-accent">
                {activeThread.title}
              </h2>
              <div className="flex items-center space-x-0">
                <div className="px-3 py-2 border border-border rounded-lg text-xs text-content-accent">
                  {0 ? "Public Link Created" : "Private"}
                </div>

                <div
                  className="relative thread-actions-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="p-1 text-gray-400 hover:text-white rounded-full transition-colors"
                    onClick={() => setIsOpen((isOpen) => !isOpen)}
                    title="Thread actions"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="absolute right-0 mt-1 bg-surface-secondary border border-border rounded-md shadow-lg py-1 w-40 z-10">
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-surface-tertiary"
                        onClick={() => {
                          // onPin(thread);
                          setIsOpen(false);
                        }}
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-2"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                          />
                        </svg>
                        {/* {thread.pinned ? "Unpin thread" : "Pin thread"} */}
                      </button>

                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-surface-tertiary"
                        onClick={() => {
                          // onHide(thread);
                          setIsOpen(false);
                        }}
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-2"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                        Hide from list
                      </button>

                      <div className="border-t border-border my-1"></div>
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
                        onClick={() => {
                          const currStatus = ref.current.toggleShowJson();
                          setStateMirror((prev) => ({
                            ...prev,
                            showJson: currStatus,
                          }));
                        }}
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle
                            fill={stateMirror.showJson ? "#000" : "#fff"}
                            cx="12"
                            cy="12"
                            r="10"
                          ></circle>
                        </svg>
                        Raw JSON
                      </button>
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
                        onClick={() => {
                          const currStatus = ref.current.toggleDevNote();
                          setStateMirror((prev) => ({
                            ...prev,
                            showDevNote: currStatus,
                          }));
                        }}
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle
                            fill={stateMirror.showDevNote ? "#000" : "#fff"}
                            cx="12"
                            cy="12"
                            r="10"
                          ></circle>
                        </svg>
                        Endpoint Info
                      </button>
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
                        onClick={() => {
                          const currStatus = ref.current.toggleActivityChart();
                          setStateMirror((prev) => ({
                            ...prev,
                            showActivityChart: currStatus,
                          }));
                        }}
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle
                            fill={
                              stateMirror.showActivityChart ? "#000" : "#fff"
                            }
                            cx="12"
                            cy="12"
                            r="10"
                          ></circle>
                        </svg>
                        Activity Chart
                      </button>

                      <div className="border-t border-border my-1"></div>
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to delete this thread?"
                            )
                          ) {
                            // onDelete(thread);
                          }
                          setIsOpen(false);
                        }}
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-2"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete thread
                      </button>
                    </div>
                  )}
                </div>
                {/*  */}
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
                  ? "bg-surface-secondary border border-border text-content-primary"
                  : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
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
                  ? "bg-surface-secondary border border-border text-content-primary"
                  : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
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
                      ? "bg-surface-secondary border border-border text-content-primary"
                      : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
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
                      ? "bg-surface-secondary border border-border text-content-primary"
                      : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
                  } px-6 py-2 rounded-lg font-medium`}
                >
                  Access
                  <span className="ml-2 text-xs text-content-secondary">
                    ({counts.access})
                  </span>
                </button>
                <button
                  onClick={handleShareUrlCreate}
                  className="bg-surface-primary border border-border max-h-10 overflow-truncate truncate text-content-accent px-6 py-2 rounded-lg font-medium"
                >
                  Share URL
                </button>
              </>
            )}
          </div>

          {currentTab === "posts" && (
            <div>
              {/* {false && <ThreadShareURL shareUrl={url} /> } */}
              <ThreadPostList
                thread={activeThread}
                isShareUrl={isShareUrl}
                activeThreadPosts={activeThreadPosts}
                ref={ref}
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
