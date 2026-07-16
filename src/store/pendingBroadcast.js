import crypto from "node:crypto";

let pending = null; // { id, text }

export function setPendingBroadcast(text) {
  pending = { id: crypto.randomUUID().slice(0, 8), text };
  return pending;
}

export function getPendingBroadcast(id) {
  return pending && pending.id === id ? pending : null;
}

export function clearPendingBroadcast() {
  pending = null;
}
