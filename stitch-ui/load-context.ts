import { type PlatformProxy } from "wrangler";
import type { StorageClients } from "~/clients/types";

type Cloudflare = Omit<PlatformProxy<Env>, "dispose">;

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
    storageClients: StorageClients;
    appConstants: Record<string, any>;
  }
}
