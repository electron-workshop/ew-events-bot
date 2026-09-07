// Cuts a release: bumps package.json, moves the Unreleased changelog notes
// under the new version, commits and tags. Does not push — that's your call.
//
//   npm run release patch      0.1.0 -> 0.1.1
//   npm run release minor      0.1.0 -> 0.2.0
//   npm run release 0.4.0      explicit
//
// Also refreshes the web app's public/versions.json in the sibling checkout,
// which you then commit and push over there.
//
// Then: git push && git push --tags, deploy, and run /release in the bot.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { syncVersions } from "./sync-versions.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const changelogPath = fileURLToPath(new URL("../CHANGELOG.md", import.meta.url));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;

  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  fail(`Unknown bump "${bump}" — use major, minor, patch, or an explicit x.y.z`);
}

const bump = process.argv[2];
if (!bump) fail("Usage: npm run release <major|minor|patch|x.y.z>");

if (git("status", "--porcelain")) {
  fail("Working tree isn't clean — commit or stash first.");
}

const pkgSource = readFileSync(pkgPath, "utf8");
const version = nextVersion(JSON.parse(pkgSource).version, bump);

if (git("tag", "--list", `v${version}`)) {
  fail(`Tag v${version} already exists.`);
}

// Split the changelog at the Unreleased heading and the release heading below it.
const lines = readFileSync(changelogPath, "utf8").split("\n");
const unreleasedAt = lines.findIndex((line) => /^##\s+\[Unreleased\]\s*$/i.test(line));
if (unreleasedAt === -1) fail("No '## [Unreleased]' heading in CHANGELOG.md");

const afterUnreleased = lines.slice(unreleasedAt + 1);
const nextHeadingAt = afterUnreleased.findIndex((line) => /^##\s+\[/.test(line));
const bodyEnd = nextHeadingAt === -1 ? lines.length : unreleasedAt + 1 + nextHeadingAt;

const body = lines.slice(unreleasedAt + 1, bodyEnd);
if (!body.some((line) => /^[-*]\s+/.test(line.trim()))) {
  fail("Nothing under '## [Unreleased]' — add the release notes before cutting a release.");
}

// Trim blank lines so the rebuilt section spaces evenly.
while (body.length && !body[0].trim()) body.shift();
while (body.length && !body[body.length - 1].trim()) body.pop();

const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const rebuilt = [
  ...lines.slice(0, unreleasedAt + 1),
  "",
  `## [${version}] - ${date}`,
  "",
  ...body,
  "",
  ...lines.slice(bodyEnd),
];

writeFileSync(changelogPath, rebuilt.join("\n"));
writeFileSync(pkgPath, pkgSource.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));

git("add", "package.json", "CHANGELOG.md");
git("commit", "-m", `Release v${version}`);
git("tag", "-a", `v${version}`, "-m", `v${version}`);

console.log(`✓ Released v${version}`);

// The web app's version panel reads a static file in that repo, so the release
// isn't finished until that file catches up.
syncVersions();

console.log("  Next: git push && git push --tags, deploy, then /release in the bot.");
