import React, { useState, useEffect } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { clientMiddleware } from "~/middleware/storageClient";
import type {
  Thread,
  Document as TDocument,
  APIKey,
  Webhook,
  Post,
  LoaderData,
} from "~/clients/types";
import SettingsModal from "~/components/SettingsModal";
import { RestThreadClient } from "~/clients/rest";
import { getBuildHash } from "~/utils/build-hash.server";
import Topbar from "~/components/Topbar";
import Sidebar from "~/components/Sidebar";
import MainContent from "~/components/MainContent";
import { getInitialThreadActionsState } from "~/components/ThreadActionsContext";

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

  // TODO: infer timezone from request headers/cookies or fallback to UTC
  const timeZone = "America/New_York";

  const offsetUTCStringByTimeZone = (
    utcTimeString: string,
    timeZone: string
  ) => {
    const date = new Date(utcTimeString);
    const offset = date.getTimezoneOffset();
    const offsetDate = new Date(date.getTime() - offset * 60 * 1000);
    return offsetDate.toLocaleString("en-US", { timeZone });
  };

  // Get thread viewing state from cookie
  const threadViewingState = getInitialThreadActionsState(request);

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
            const timeKeys = ["created_at", "updated_at", "last_activity"];
            timeKeys.forEach((key) => {
              // @ts-ignore
              if (thread[key]) {
                // @ts-ignore
                thread[key] = offsetUTCStringByTimeZone(thread[key], timeZone);
              }
            });
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
          .then((posts) => {
            return posts.map((post) => {
              post.time = offsetUTCStringByTimeZone(post.time, timeZone);
              return post;
            });
          })
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
    threadViewingState,
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
    threadViewingState,
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
        <div className="h-16 bg-surface-tertiary border-b border-border flex justify-center items-center px-6">
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
          threadViewingState={threadViewingState}
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
      <div className="fixed bottom-0 w-full bg-surface-secondary border-t border-border p-2 z-[1000]">
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
            &copy; 2025 Stitch | Version {buildHash}
          </div>
        </div>
      </div>
    </div>
  );
}
