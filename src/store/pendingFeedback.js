import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { log } from "../logger.js";

// Persisted, unlike the other pending stores: feedback can sit waiting for the
// admin for hours, and a deploy restart in that window would otherwise throw
// away something a person took the trouble to write.
const FILE_PATH = path.join(new URL("../data/", import.meta.url).pathname, "feedback.json");

const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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

let feedback = load(); // [{ id, text, from, chatId, createdAt, status, issueUrl }]

export function addFeedback({ text, from, chatId }) {
  const entry = {
    id: crypto.randomUUID().slice(0, 8),
    text,
    from, // { id, label }
    chatId,
    createdAt: Date.now(),
    status: "pending", // pending | filed | dismissed
    issueUrl: null,
  };
  feedback.push(entry);
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
    (entry) => String(entry.from.id) === String(userId) && entry.createdAt > cutoff
  ).length;
}

export function isRateLimited(userId) {
  return recentCountFrom(userId) >= RATE_LIMIT;
}

export { RATE_LIMIT };
