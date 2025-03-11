import { RestThreadClient } from "~/clients/rest";
import { D1ThreadClient } from "~/clients/d1";

import type { ThreadClient, BackendConnection } from "~/clients/types";
import type { AppLoadContext } from "@remix-run/cloudflare";

// Global constants for app-wide use.
const appConstants = {
  MEANING_OF_LIFE: 42,
};

/**
 * Middleware that initializes the storage clients based on the request's
 * `Cookie` header. The `servers` cookie should be a comma-separated list of
 * server names (e.g. "local,d1").
 */
export const clientMiddleware = async (
  request: Request,
  loadContext: AppLoadContext
) => {
  const cookie = request.headers.get("Cookie");
  const backends = cookie?.split(";").find((c) => c.includes("backends"));
  // TODO: revisit if we need the apikeys cookie.
  const apiKeys = cookie?.split(";").find((c) => c.includes("apiKeys"));
  const backendsValue = backends?.split("=")[1] || "[]";
  const apiKeysValue = apiKeys?.split("=")[1] || "[]";
  const backendsJson: BackendConnection[] = JSON.parse(backendsValue);
  const apiKeysJson: Record<string, string>[] = JSON.parse(apiKeysValue);
  const storageClients: Record<string, ThreadClient> = {};
  for (const { url: server, token } of backendsJson) {
    if (server.startsWith("http")) {
      storageClients[server] = new RestThreadClient(server, token);
    } else if (server === "local") {
      const { SqliteThreadWrapperClient, FileStoreWrapperClient } = await import("~/clients/local");
      const client = await SqliteThreadWrapperClient.initialize("./local.db") as unknown as D1Database;
      const store = await FileStoreWrapperClient.initialize("./local_bucket")
      storageClients["local"] = await D1ThreadClient.initialize(client, store);
    } else if (server === "d1") {
      // TODO: refactor and consolidate all the clients into one.
      // @ts-ignore-next-line
      const db = loadContext.cloudflare.env.DB;
      // @ts-ignore-next-line
      const bucket = loadContext.cloudflare.env.BUCKET;
      storageClients[server] = await D1ThreadClient.initialize(db, bucket);
    } else {
      console.error("Unknown server:", server);
    }
  }
  loadContext.apiKeysJson = apiKeysJson;
  loadContext.backendsJson = backendsJson;
  loadContext.storageClients = storageClients;
  loadContext.appConstants = appConstants;
  return loadContext;
};
