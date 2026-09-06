// Merges two knownChats.json files into one.
//
// Written for moving the bot between machines: deploy somewhere new before the
// old box is reachable, then fold the old chat list back in when it returns.
//
//   node scripts/merge-chats.js <old.json> <new.json>            # dry run
//   node scripts/merge-chats.js <old.json> <new.json> --write    # writes new.json
//
// The rules that matter:
//
//   announcements  an opt-out wins, always. Someone who turned announcements
//                  off and then messaged the new bot gets re-recorded as
//                  subscribed, and merging must not resurrect them.
//   promptedAt     the earliest stamp wins, so nobody is asked twice.
//   type           whichever file actually has one.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const [oldPath, newPath, ...flags] = process.argv.slice(2);
if (!oldPath || !newPath) {
  fail("Usage: node scripts/merge-chats.js <old.json> <new.json> [--write]");
}
const write = flags.includes("--write");

function load(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail(`${path} isn't a knownChats object`);
    }
    return parsed;
  } catch (error) {
    fail(`couldn't read ${path}: ${error.message}`);
  }
}

const before = load(oldPath);
const after = load(newPath);

const merged = {};
const stats = { total: 0, onlyOld: 0, onlyNew: 0, both: 0, optOutsKept: 0, promptsKept: 0 };

for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const a = before[id];
  const b = after[id];
  stats.total++;
  if (a && !b) stats.onlyOld++;
  else if (!a && b) stats.onlyNew++;
  else stats.both++;

  // Missing means "recorded before this setting existed", which the bot treats
  // as subscribed — so only an explicit false counts as an opt-out.
  const optedOut = a?.announcements === false || b?.announcements === false;
  if (optedOut && b?.announcements !== false) stats.optOutsKept++;

  const stamps = [a?.promptedAt, b?.promptedAt].filter(Boolean);
  const promptedAt = stamps.length ? Math.min(...stamps) : null;
  if (promptedAt && !b?.promptedAt) stats.promptsKept++;

  merged[id] = {
    type: b?.type || a?.type || "private",
    announcements: !optedOut,
    promptedAt,
  };
}

console.log(`old: ${Object.keys(before).length} chats`);
console.log(`new: ${Object.keys(after).length} chats`);
console.log(`merged: ${stats.total} chats — ${stats.both} in both, ${stats.onlyOld} only in old, ${stats.onlyNew} only in new`);
console.log(`  opt-outs rescued from the old file: ${stats.optOutsKept}`);
console.log(`  prompt stamps carried over:         ${stats.promptsKept}`);

if (!write) {
  console.log("\nDry run. Re-run with --write to apply.");
  process.exit(0);
}

copyFileSync(newPath, `${newPath}.bak`);
writeFileSync(newPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`\n✓ Wrote ${newPath} (previous version saved as ${newPath}.bak)`);
