import crypto from "node:crypto";

// People routinely leave a preview sitting for half an hour before coming back
// to it, so this is deliberately generous.
const TTL_MS = 2 * 60 * 60 * 1000;

const pending = new Map();

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of pending) {
    if (now - entry.createdAt > TTL_MS) {
      pending.delete(id);
    }
  }
}

export function createPending({ chatId, requesterId, requesterName, sourceUrl, fields }) {
  cleanup();
  const id = crypto.randomUUID().slice(0, 8);
  pending.set(id, {
    id,
    chatId,
    requesterId,
    requesterName,
    sourceUrl,
    fields,
    editMessageId: null,
    editRequestedAt: null,
    createdAt: Date.now(),
  });
  return id;
}

export function getPending(id) {
  return pending.get(id) || null;
}

export function updatePendingFields(id, fields) {
  const entry = pending.get(id);
  if (!entry) return null;
  entry.fields = { ...entry.fields, ...fields };
  return entry;
}

// Marks this pending as the one the requester is currently editing, so their
// next message counts as the edit whether or not they use Telegram's reply.
export function markAwaitingEdit(id) {
  const entry = pending.get(id);
  if (!entry) return null;
  entry.editRequestedAt = Date.now();
  return entry;
}

export function clearAwaitingEdit(id) {
  const entry = pending.get(id);
  if (!entry) return null;
  entry.editRequestedAt = null;
  return entry;
}

export function setEditMessageId(id, messageId) {
  const entry = pending.get(id);
  if (!entry) return null;
  entry.editMessageId = messageId;
  return entry;
}

export function findPendingByEditMessage(chatId, messageId) {
  cleanup();
  for (const entry of pending.values()) {
    if (entry.chatId === chatId && entry.editMessageId === messageId) {
      return entry;
    }
  }
  return null;
}

// The edit this person most recently asked for in this chat. Newest wins, so
// hitting Edit on a second event doesn't get shadowed by an older draft.
export function findAwaitingEdit(chatId, requesterId) {
  cleanup();
  let latest = null;
  for (const entry of pending.values()) {
    if (entry.chatId !== chatId) continue;
    if (String(entry.requesterId) !== String(requesterId)) continue;
    if (!entry.editRequestedAt) continue;
    if (!latest || entry.editRequestedAt > latest.editRequestedAt) latest = entry;
  }
  return latest;
}

// True if this chat has any live draft at all — lets the fallback tell
// "your edit expired" apart from "I have no idea what you mean".
export function hasPendingInChat(chatId) {
  cleanup();
  for (const entry of pending.values()) {
    if (entry.chatId === chatId) return true;
  }
  return false;
}

export function deletePending(id) {
  pending.delete(id);
}
