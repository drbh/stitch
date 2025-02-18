import { RestThreadClient } from "~/clients/rest";
import { D1ThreadClient } from "~/clients/d1";

import type { ThreadClient } from "~/clients/types";
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
  const servers = cookie?.split(";").find((c) => c.includes("servers"));
  const serversValue = servers?.split("=")[1].split(",") || [];
  const storageClients: Record<string, ThreadClient> = {};
  for (const server of serversValue) {
    if (server.startsWith("http")) {
      storageClients[server] = new RestThreadClient(server);
    } else if (server === "local") {
      const { SqliteThreadClient } = await import("~/clients/sqlite");
      storageClients[server] = await SqliteThreadClient.initialize("./app.db");
    } else if (server === "d1") {
      const db = loadContext.cloudflare.env.DB;
      storageClients[server] = await D1ThreadClient.initialize(db);
    } else {
      console.error("Unknown server:", server);
    }
  }
  loadContext.storageClients = storageClients;
  loadContext.appConstants = appConstants;
  return loadContext;
};
