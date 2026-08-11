const TTL_MS = 10 * 60 * 1000; // give up waiting for the feedback text after 10 minutes

const awaiting = new Map(); // `${chatId}:${userId}` -> timestamp

function key(chatId, userId) {
  return `${chatId}:${userId}`;
}

export function setAwaitingFeedback(chatId, userId) {
  awaiting.set(key(chatId, userId), Date.now());
}

export function clearAwaitingFeedback(chatId, userId) {
  awaiting.delete(key(chatId, userId));
}

export function isAwaitingFeedback(chatId, userId) {
  const k = key(chatId, userId);
  const startedAt = awaiting.get(k);
  if (!startedAt) return false;
  if (Date.now() - startedAt > TTL_MS) {
    awaiting.delete(k);
    return false;
  }
  return true;
}
