const TTL_MS = 15 * 60 * 1000; // writing an issue takes longer than writing feedback

const awaiting = new Map(); // `${chatId}:${userId}` -> { feedbackId, startedAt }

function key(chatId, userId) {
  return `${chatId}:${userId}`;
}

export function setAwaitingIssue(chatId, userId, feedbackId) {
  awaiting.set(key(chatId, userId), { feedbackId, startedAt: Date.now() });
}

export function clearAwaitingIssue(chatId, userId) {
  awaiting.delete(key(chatId, userId));
}

/** The feedback the admin is currently writing an issue for, or null. */
export function getAwaitingIssue(chatId, userId) {
  const k = key(chatId, userId);
  const entry = awaiting.get(k);
  if (!entry) return null;
  if (Date.now() - entry.startedAt > TTL_MS) {
    awaiting.delete(k);
    return null;
  }
  return entry.feedbackId;
}
