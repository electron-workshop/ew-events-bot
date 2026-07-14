import crypto from "node:crypto";

const TTL_MS = 30 * 60 * 1000; // pending confirmations expire after 30 minutes

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

export function deletePending(id) {
  pending.delete(id);
}
