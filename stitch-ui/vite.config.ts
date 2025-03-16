import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";
import { getBuildHash } from "./app/utils/build-hash.server";

declare module "@remix-run/cloudflare" {
  interface Future {
    v3_singleFetch: true;
  }
}

// Get formatted version with commit date and git hash
const getVersionHash = () => {
  try {
    console.log("Calculate version hash...");
    return getBuildHash();
  } catch (e) {
    return "development";
  }
};

const versionHash = getVersionHash();

export default defineConfig({
  plugins: [
    remixCloudflareDevProxy(),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
  define: {
    "import.meta.env.SOURCE_HASH": JSON.stringify(versionHash),
  },
});
