import crypto from "node:crypto";

// Telegram callback_data is capped at 64 bytes, but Google Calendar event IDs
// (especially synced/imported ones, not created by this bot) can be much
// longer than that. So buttons reference a short-lived local token instead
// of the real event ID.
const TTL_MS = 60 * 60 * 1000; // 1 hour — plenty of time to tap a button after listing

const refs = new Map(); // shortId -> { eventId, createdAt }

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of refs) {
    if (now - entry.createdAt > TTL_MS) refs.delete(id);
  }
}

export function createEventRef(eventId) {
  cleanup();
  const shortId = crypto.randomUUID().slice(0, 8);
  refs.set(shortId, { eventId, createdAt: Date.now() });
  return shortId;
}

export function resolveEventRef(shortId) {
  cleanup();
  const entry = refs.get(shortId);
  return entry ? entry.eventId : null;
}
