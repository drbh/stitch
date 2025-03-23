import { clientMiddleware } from "~/middleware/storageClient";
import { RestThreadClient } from "~/clients/rest";

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
    "updatePost",
    "updateSettings",
    "createWebhook",
    "removeWebhook",
    "testWebhook",
    "createDocument",
    "deleteDocument",
    "deleteThread",
    "deletePost",
    "shareUrlCreate",
    "createApiKey",
    "updateApiKey",
    "removeApiKey",
    "getApiKeys",
    "updateThreadViewingState",
    "updateThemePreference",
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
    const newPost = await storageClient.createPost(parseInt(threadId), {
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
  } else if (intent === "updatePost") {
    const postId = String(formData.get("postId"));
    const content = String(formData.get("content"));
    const url = new URL(request.url);
    const threadId = String(url.searchParams.get("t"));
    const server = String(url.searchParams.get("s"));

    if (!postId || !content) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post ID and content are required",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    try {
      const storageClient = context.storageClients[server];
      if (!storageClient) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Invalid server",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      // Update the post
      const updatedPost = await storageClient.updatePost(parseInt(postId), {
        text: content,
      });

      const data: { success: boolean } = { success: true };
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message || "Failed to update post",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
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
    const eventTypes = formData.get("eventTypes")
      ? JSON.parse(String(formData.get("eventTypes")))
      : null;

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, message: "URL is required" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    try {
      // Add webhook with additional metadata
      const _newWebhook = await context.storageClients[server].addWebhook(
        parseInt(threadId),
        url,
        secret
      );

      const data: { success: boolean; webhook?: any } = {
        success: true,
        webhook: _newWebhook,
      };

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message || "Failed to create webhook",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  } else if (intent === "removeWebhook") {
    const webhookId = String(formData.get("webhookId"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!webhookId) {
      return new Response(
        JSON.stringify({ success: false, message: "Webhook ID is required" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    try {
      await context.storageClients[server].removeWebhook(parseInt(webhookId));

      const data: { success: boolean } = { success: true };
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message || "Failed to remove webhook",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  } else if (intent === "testWebhook") {
    const webhookId = String(formData.get("webhookId"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));
    // Optional custom event type but only from predefined list
    const eventType = String(formData.get("eventType") || "post_created");

    // Validate event type is one of the allowed values
    const allowedEventTypes = [
      "post_created",
      "post_updated",
      "post_deleted",
      "document_created",
      "document_updated",
      "document_deleted",
    ];

    if (!allowedEventTypes.includes(eventType)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid event type",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!webhookId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Webhook ID is required",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    try {
      // Get the webhook to access its URL and secret
      const webhooks = await context.storageClients[server].getThreadWebhooks(
        parseInt(threadId)
      );
      const webhook = webhooks.find((w) => w.id === parseInt(webhookId));

      if (!webhook) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Webhook not found",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 404,
          }
        );
      }

      // Server-defined default payload based on the event type
      const defaultPayload = {
        event: eventType,
        data: eventType.startsWith("post")
          ? {
              id: 123,
              thread_id: parseInt(threadId),
              author: "system",
              text: "This is a test webhook payload",
              time: new Date().toISOString(),
              is_initial_post: false,
            }
          : {
              id: 456,
              thread_id: parseInt(threadId),
              title: "Test Document",
              type: "text/plain",
              content: "Test document content",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
        timestamp: new Date().toISOString(),
      };

      const webhookTestHeaders: HeadersInit = {
        "Content-Type": "application/json",
        "X-Webhook-Test": "true",
      };

      // Convert payload to JSON string - we'll use this for both the request body and signature
      const payloadString = JSON.stringify(defaultPayload);

      // Generate HMAC-SHA256 signature if a secret is provided
      if (webhook.api_key) {
        // Use Web Crypto API to generate the HMAC signature
        // First, encode the message and key
        const encoder = new TextEncoder();
        const messageUint8 = encoder.encode(payloadString);
        const keyUint8 = encoder.encode(webhook.api_key);

        // Import the key
        const key = await crypto.subtle.importKey(
          "raw",
          keyUint8,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );

        // Sign the message
        const signature = await crypto.subtle.sign("HMAC", key, messageUint8);

        // Convert the signature to hex
        const signatureHex = Array.from(new Uint8Array(signature))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Add the signature to the headers
        webhookTestHeaders["X-Webhook-Signature"] = signatureHex;
      }

      // Make the actual HTTP request to the webhook URL
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: webhookTestHeaders,
        body: JSON.stringify(defaultPayload),
      });

      // Read the response data
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      // Collect response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Update the webhook's last_triggered timestamp if available
      try {
        if (context.storageClients[server].updateWebhookLastTriggered) {
          await context.storageClients[server].updateWebhookLastTriggered(
            parseInt(webhookId)
          );
        }
      } catch (e) {
        console.error("Failed to update webhook last_triggered:", e);
      }

      const testResponse = {
        success: true,
        status: response.status,
        headers: headers,
        data: responseData,
        sentPayload: defaultPayload,
      };

      console.log("Response from webhook test:", testResponse);

      return new Response(JSON.stringify(testResponse), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message || "Failed to test webhook",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  } else if (intent === "createDocument") {
    const title = String(formData.get("title"));
    const threadId = String(new URL(request.url).searchParams.get("t"));
    const server = String(new URL(request.url).searchParams.get("s"));
    const fileType = formData.get("type") || "text";

    // Check if file upload or text content
    const file = formData.get("file");
    let content = "";

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, message: "Title is required" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (file instanceof File) {
      // For multimedia files (images, audio, video), we'll use the bucket storage

      // TODO: revisit how to handled text based (editable files?)
      if (file.type.startsWith("text/")) {
        // For text files, read their content
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder();
        content = decoder.decode(new Uint8Array(buffer));
      } else {
        // For non-text files, set placeholder content
        // The actual file will be stored in the bucket by the storage client
        content = null;
      }

      const newDocument = await context.storageClients[server].createDocument(
        parseInt(threadId),
        {
          title,
          content,
          type: String(file.type),
          file, // Pass the actual file to be stored in bucket
        }
      );
    } else {
      // Handle text content
      content = String(formData.get("content") || "");

      if (!content) {
        return new Response(
          JSON.stringify({ success: false, message: "Content is required" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      const newDocument = await context.storageClients[server].createDocument(
        parseInt(threadId),
        { title, content, type: String(fileType) }
      );
    }

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

    // Get document data before deletion for the webhook payload
    let documentData = null;
    const storageClient = context.storageClients[server];
    const threadId = String(new URL(request.url).searchParams.get("t"));

    try {
      // If there's a getDocument method, use it to get document data for the webhook
      if (storageClient.getDocument) {
        documentData = await storageClient.getDocument(docId);
      }

      // deleteDocument
      await storageClient.deleteDocument(docId);
    } catch (error) {
      console.error("Error deleting document:", error);
      // Continue with the deletion even if webhook triggering fails
    }

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
  } else if (intent === "deletePost") {
    const postId = String(formData.get("postId"));
    const server = String(new URL(request.url).searchParams.get("s"));
    const threadId = String(new URL(request.url).searchParams.get("t"));

    if (!postId) {
      return new Response(null, { status: 400 });
    }

    // Get the post data before deleting it for the webhook payload
    let postData = null;
    try {
      const storageClient = context.storageClients[server];
      // First get the post information if available
      if (storageClient.getPost) {
        postData = await storageClient.getPost(parseInt(postId));
      }

      // deletePost
      await storageClient.deletePost(parseInt(postId));
    } catch (error) {
      console.error("Error in deletePost:", error);
    }

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

    // Default to read-only permissions for new keys
    const _newApiKey = await context.storageClients[server].createAPIKey(
      Number(threadId),
      name,
      {
        read: true,
        write: false,
        delete: false,
      }
    );

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "updateApiKey") {
    const apiKey = String(formData.get("apiKey"));
    const keyId = String(formData.get("keyId"));
    const keyName = String(formData.get("keyName"));
    const permissionsStr = String(formData.get("permissions"));
    const server = String(new URL(request.url).searchParams.get("s"));
    if (!apiKey) {
      return new Response(null, { status: 400 });
    }

    // Parse permissions from string
    let permissions;
    try {
      permissions = JSON.parse(permissionsStr);
    } catch (e) {
      // Default to read-only if parsing fails
      permissions = { read: true, write: false, delete: false };
    }

    // Update the API key
    await context.storageClients[server].updateAPIKey(keyId, permissions);

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "removeApiKey") {
    const id = String(formData.get("id"));
    const server = String(new URL(request.url).searchParams.get("s"));

    if (!id) {
      return new Response(null, { status: 400 });
    }

    // Delete the API key
    await context.storageClients[server].deleteAPIKey(id);

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else if (intent === "updateThreadViewingState") {
    const stateJson = String(formData.get("state"));

    if (!stateJson) {
      return new Response(null, { status: 400 });
    }

    try {
      // Parse the state to validate it
      const state = JSON.parse(stateJson);

      // Set cookie with the thread viewing state
      const cookieOptions = [
        `threadViewingState=${encodeURIComponent(stateJson)}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Max-Age=31536000", // 1 year
      ];

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.append("Set-Cookie", cookieOptions.join("; "));

      const data: { success: boolean } = { success: true };
      return new Response(JSON.stringify(data), { headers });
    } catch (error) {
      console.error("Error parsing thread viewing state:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid thread viewing state",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
  } else if (intent === "updateThemePreference") {
    const theme = formData.get("theme") ? String(formData.get("theme")) : null;
    const accentColor = formData.get("accentColor")
      ? String(formData.get("accentColor"))
      : null;

    // If no theme and no accent color, return error
    if (!theme && !accentColor) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Either theme or accentColor must be provided",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate theme if provided
    if (theme && theme !== "dark" && theme !== "light") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid theme preference",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    // const domain = ".stitch.sh";
    const domain = "localhost";

    // Set theme cookie if theme is provided
    if (theme) {
      const themeCookieOptions = [
        `themePreference=${theme}`,
        "Path=/",
        `Domain=${domain}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Max-Age=31536000", // 1 year
      ];
      headers.append("Set-Cookie", themeCookieOptions.join("; "));
    }

    // Set accent color cookie if accent color is provided
    if (accentColor) {
      const accentColorCookieOptions = [
        `accentColor=${accentColor}`,
        "Path=/",
        `Domain=${domain}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Max-Age=31536000", // 1 year
      ];
      headers.append("Set-Cookie", accentColorCookieOptions.join("; "));
    }

    const data: { success: boolean } = { success: true };
    return new Response(JSON.stringify(data), { headers });
  } else {
    return new Response(null, { status: 400 });
  }
};

export default _action;
