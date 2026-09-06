import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { log } from "../logger.js";
import { dataFile } from "./dataDir.js";
import { config } from "../config.js";

// Persisted, unlike the other pending stores: feedback can sit waiting for the
// admin for hours, and a deploy restart in that window would otherwise throw
// away something a person took the trouble to write.
const FILE_PATH = dataFile("feedback.json");

const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;
// Drafts are feedback someone typed but never chose to send. They're kept only
// long enough for the buttons under the message to still work.
const DRAFT_TTL_MS = 60 * 60 * 1000;
// Abandoning a draft shouldn't use up someone's quota — only feedback that
// actually reached the admin counts.
const COUNTS_TOWARD_LIMIT = new Set(["pending", "filed", "dismissed"]);

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      log("feedback", `failed to read ${FILE_PATH}: ${error.message}`);
    }
    return [];
  }
}

function save(entries) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(entries, null, 2));
}

// [{ id, text, from, chatId, createdAt, status, anonymous, issueUrl }]
let feedback = load();

function pruneDrafts(entries) {
  const cutoff = Date.now() - DRAFT_TTL_MS;
  return entries.filter((entry) => entry.status !== "draft" || entry.createdAt > cutoff);
}

export function addFeedback({ text, from, chatId }) {
  feedback = pruneDrafts(feedback);
  const entry = {
    id: crypto.randomUUID().slice(0, 8),
    text,
    from, // { id, label } — kept on the server whatever the sender chooses
    chatId,
    createdAt: Date.now(),
    // Starts as a draft: the sender still has to say whether their name goes
    // with it and confirm that, before the admin is told anything at all.
    status: "draft", // draft | pending | filed | dismissed | cancelled
    anonymous: null,
    issueUrl: null,
  };
  feedback.push(entry);
  save(feedback);
  return entry;
}

/** Records the sender's choice and releases the draft to the admin. */
export function attributeFeedback(id, { anonymous }) {
  const entry = getFeedback(id);
  if (!entry) return null;
  entry.anonymous = anonymous;
  entry.status = "pending";
  save(feedback);
  return entry;
}

/** The issue text the admin has written but not yet confirmed. */
export function setDraftIssue(id, draft) {
  const entry = getFeedback(id);
  if (!entry) return null;
  entry.draftIssue = draft; // { title, body }
  save(feedback);
  return entry;
}

export function cancelFeedback(id) {
  const entry = getFeedback(id);
  if (!entry) return null;
  entry.status = "cancelled";
  save(feedback);
  return entry;
}

export function getFeedback(id) {
  return feedback.find((entry) => entry.id === id) || null;
}

export function resolveFeedback(id, { status, issueUrl = null }) {
  const entry = getFeedback(id);
  if (!entry) return null;
  entry.status = status;
  entry.issueUrl = issueUrl;
  save(feedback);
  return entry;
}

// How many pieces of feedback this person has sent in the last hour, so one
// person can't flood the admin's DMs.
export function recentCountFrom(userId) {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  return feedback.filter(
    (entry) =>
      String(entry.from.id) === String(userId) &&
      entry.createdAt > cutoff &&
      COUNTS_TOWARD_LIMIT.has(entry.status)
  ).length;
}

export function isRateLimited(userId) {
  // The limit exists to stop one person flooding the admin's DMs. The admin
  // flooding their own DMs is just testing, and they're the only person who
  // ever needs to send feedback repeatedly.
  if (config.adminChatId && String(userId) === String(config.adminChatId)) return false;
  return recentCountFrom(userId) >= RATE_LIMIT;
}

export { RATE_LIMIT };
