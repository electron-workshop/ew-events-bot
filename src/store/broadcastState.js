// Single-admin, single-draft-at-a-time state for the /blast flow. In-memory
// is fine here — if the bot restarts mid-draft, the admin just runs /blast
// again, no data loss that matters.
const TTL_MS = 10 * 60 * 1000;

let awaitingSince = null;

export function startAwaitingBroadcast() {
  awaitingSince = Date.now();
}

export function isAwaitingBroadcast() {
  if (!awaitingSince) return false;
  if (Date.now() - awaitingSince > TTL_MS) {
    awaitingSince = null;
    return false;
  }
  return true;
}

export function clearAwaitingBroadcast() {
  awaitingSince = null;
}
