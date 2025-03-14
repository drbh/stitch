import { execSync } from "child_process";


export function getBuildHash(): string {
  try {
    const gitIncludingStaged =
      'echo "$(git rev-parse HEAD)$(git diff --staged)" | md5sum | cut -c1-7';
    const date = new Date().toISOString().replace(/[^0-9]/g, ".").slice(0, 10);
    const hash = execSync(gitIncludingStaged).toString().trim();
    const ver = `${date}.${hash}`;
    console.warn("[TRACE] Using dev hash:", `${ver}.dev`);
    return `${ver}.dev`;
  } catch (e) {
    const sourceHash = import.meta.env.SOURCE_HASH;
    console.warn("[TRACE] Falling back to SOURCE_HASH:", sourceHash);
    return sourceHash.replace(/\.dev$/, "");
  }
}
