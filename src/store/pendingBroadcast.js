import crypto from "node:crypto";

let pending = null; // { id, text, draft }

// `draft` marks notes for a version that hasn't been cut yet. Those can go to
// the admin or the beta testers, but never to everyone.
export function setPendingBroadcast(text, { draft = false, html = false } = {}) {
  pending = { id: crypto.randomUUID().slice(0, 8), text, draft, html };
  return pending;
}

export function getPendingBroadcast(id) {
  return pending && pending.id === id ? pending : null;
}

export function clearPendingBroadcast() {
  pending = null;
}
