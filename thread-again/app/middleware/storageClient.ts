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
  const env = process.env.NODE_ENV;
  if (backendsJson.length == 0) {
    const defaultBackends = [];
    if (env === "development") {
      defaultBackends.push({
        id: "0",
        name: "Default",
        url: "local",
        token: "",
        isActive: true,
      });
    } else {
      // NODE_ENV is only set in development mode.
      // TODO: review a better way to handle this.
      defaultBackends.push({
        id: "1",
        name: "Default",
        url: "d1",
        token: "",
        isActive: true,
      });
    }
    backendsJson.push(...defaultBackends);
  }
  // const serversValue = backendsJson.map((backend) => backend.url);
  const storageClients: Record<string, ThreadClient> = {};
  for (const { url: server, token } of backendsJson) {
    if (server.startsWith("http")) {
      storageClients[server] = new RestThreadClient(server, token);
    } else if (server === "local") {
      // TODO: refactor and condolidate all the clients into one.
      // const { SqliteThreadClient } = await import("~/clients/sqlite");
      // storageClients[server] = await SqliteThreadClient.initialize("./app.db");
    } else if (server === "d1") {
      // @ts-ignore-next-line
      const db = loadContext.cloudflare.env.DB;
      storageClients[server] = await D1ThreadClient.initialize(db);
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
