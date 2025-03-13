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
import CloseIcon from "~/components/CloseIcon";


const _action = async ({ request, context }) => {
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


export default _action;
