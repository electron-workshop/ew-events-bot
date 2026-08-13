#!/usr/bin/env node
// Puts the beta testers back to a fresh state — subscribed, and due to be
// offered the opt-out buttons again — so the broadcast opt-out flow can be
// tested more than once.
//
//   npm run reset-testers
//
// Only touches IDs listed in BETA_TESTERS, so it can't disturb a real user's
// choice. The bot keeps this file in memory and rewrites it on change, so it
// must not be running while this edits it.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CHATS_PATH = fileURLToPath(new URL("../src/data/knownChats.json", import.meta.url));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const testers = (process.env.BETA_TESTERS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (testers.length === 0) {
  fail("BETA_TESTERS is empty in .env — nothing to reset.");
}

// Editing under a running bot would be silently undone the next time it saves.
let running = false;
try {
  const list = execSync("pm2 jlist", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  running = JSON.parse(list).some(
    (app) => app.name === "ew-events-bot" && app.pm2_env?.status === "online"
  );
} catch {
  // No pm2 here (e.g. running on a laptop) — nothing to check.
}
if (running) {
  fail(
    "ew-events-bot is running, and it would overwrite this change.\n" +
      "  Run:  pm2 stop ew-events-bot && npm run reset-testers && pm2 start ew-events-bot"
  );
}

let chats;
try {
  chats = JSON.parse(readFileSync(CHATS_PATH, "utf8"));
} catch (error) {
  fail(
    error.code === "ENOENT"
      ? `No ${CHATS_PATH} yet — nobody has messaged the bot.`
      : `Couldn't read ${CHATS_PATH}: ${error.message}`
  );
}

const reset = [];
const unknown = [];
for (const id of testers) {
  if (!chats[id]) {
    unknown.push(id);
    continue;
  }
  chats[id].announcements = true;
  chats[id].promptedAt = null;
  reset.push(id);
}

if (reset.length > 0) {
  writeFileSync(CHATS_PATH, JSON.stringify(chats, null, 2));
}

for (const id of reset) {
  console.log(`✓ ${id} — subscribed, will be offered the opt-out buttons again`);
}
for (const id of unknown) {
  console.log(`– ${id} — not in knownChats.json, they've never messaged the bot`);
}

console.log(
  reset.length
    ? `\nReset ${reset.length} of ${testers.length} tester(s). Start the bot and send a broadcast to test.`
    : "\nNothing reset."
);
