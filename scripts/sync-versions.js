// Writes what the web app's version panel shows about the bot into that repo's
// public/versions.json.
//
// The two live in separate repos on separate deployments, so something has to
// carry the bot's version across. It used to be an hourly HTTP ping with a
// shared secret; it's now this, because the panel's data is a build-time fact
// and a static file is one less moving part (and one the service worker can
// cache later).
//
//   npm run sync-versions          write it, assuming ../ew-events-webapp
//   WEBAPP_DIR=/path npm run ...   somewhere else
//
// Run automatically at the end of `npm run release`. Safe to run any time.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseChangelog } from "../src/services/changelog.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const pkgPath = resolve(repoRoot, "package.json");

// Sibling checkout by default — the two repos sit next to each other.
const webappDir = process.env.WEBAPP_DIR
  ? resolve(process.env.WEBAPP_DIR)
  : resolve(repoRoot, "../ew-events-webapp");
const targetPath = resolve(webappDir, "public/versions.json");

export function botSection() {
  const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  // Unreleased notes are still being written and aren't for the public.
  const changelog = parseChangelog().filter(
    (entry) => entry.version.toLowerCase() !== "unreleased"
  );
  return { version, changelog };
}

export function syncVersions() {
  const bot = botSection();

  if (!existsSync(targetPath)) {
    console.log(`! Couldn't find ${targetPath}`);
    console.log("  Set WEBAPP_DIR, or paste this into public/versions.json over there:\n");
    console.log(JSON.stringify({ bot }, null, 2));
    return false;
  }

  // Keep whatever else the file holds — the app's own version is stamped in
  // over there and isn't ours to overwrite.
  const existing = JSON.parse(readFileSync(targetPath, "utf8"));
  writeFileSync(targetPath, `${JSON.stringify({ ...existing, bot }, null, 2)}\n`);

  console.log(`✓ Wrote bot v${bot.version} to ${targetPath}`);
  console.log("  Commit and push in the web app repo to publish it.");
  return true;
}

// Only act when run directly, so release.js can import the pieces.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncVersions();
}
