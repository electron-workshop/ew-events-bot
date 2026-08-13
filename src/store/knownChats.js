import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const FILE_PATH = path.join(new URL("../data/", import.meta.url).pathname, "knownChats.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      log("known_chats", `failed to read ${FILE_PATH}: ${error.message}`);
    }
    return {};
  }
}

function save(chats) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(chats, null, 2));
}

let chats = load(); // { [chatId]: { type, announcements, promptedAt } }

// Called on every incoming update so /blast knows who to reach. Only writes
// to disk the first time a chat is seen — no need to persist on every message.
export function recordChat(chatId, type) {
  const key = String(chatId);
  if (chats[key]) return;
  // Announcements start on. Starting them off would mean the first broadcast
  // reached nobody, and there'd be no way to tell people they could opt in.
  chats[key] = { type, announcements: true, promptedAt: null };
  save(chats);
}

export function getPrivateChatIds() {
  return Object.entries(chats)
    .filter(([, info]) => info.type === "private")
    .map(([id]) => Number(id));
}

// Chats that should receive a broadcast. Anything recorded before this setting
// existed has no `announcements` key, and those people never opted out — so
// treat a missing value as subscribed.
export function getBroadcastChatIds() {
  return Object.entries(chats)
    .filter(([, info]) => info.type === "private" && info.announcements !== false)
    .map(([id]) => Number(id));
}

/** Every private chat with its subscription state, for deciding and logging. */
export function getPrivateChats() {
  return Object.entries(chats)
    .filter(([, info]) => info.type === "private")
    .map(([id, info]) => ({
      id: Number(id),
      // Recorded before this setting existed means never opted out.
      subscribed: info.announcements !== false,
      prompted: Boolean(info.promptedAt),
    }));
}

/** Who a broadcast would reach, for the preview shown before sending. */
export function getBroadcastStats() {
  const priv = Object.entries(chats).filter(([, info]) => info.type === "private");
  const subscribed = priv.filter(([, info]) => info.announcements !== false);
  return {
    known: priv.length,
    subscribed: subscribed.length,
    unprompted: subscribed.filter(([, info]) => !info.promptedAt).length,
    optedOut: priv.length - subscribed.length,
  };
}

export function isSubscribed(chatId) {
  const info = chats[String(chatId)];
  return !info || info.announcements !== false;
}

export function setSubscribed(chatId, subscribed) {
  const key = String(chatId);
  if (!chats[key]) chats[key] = { type: "private", promptedAt: null };
  chats[key].announcements = subscribed;
  save(chats);
  return chats[key];
}

/**
 * True if this chat has never been shown the opt-out buttons. They're offered
 * once, on the first broadcast someone receives — ignoring them is an answer,
 * so the stamp goes on when they're sent, not when they're tapped.
 */
export function needsBroadcastPrompt(chatId) {
  const info = chats[String(chatId)];
  return !info || !info.promptedAt;
}

export function markBroadcastPrompted(chatId) {
  const key = String(chatId);
  if (!chats[key]) chats[key] = { type: "private", announcements: true };
  chats[key].promptedAt = Date.now();
  save(chats);
}
