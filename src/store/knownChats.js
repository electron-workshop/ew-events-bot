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

let chats = load(); // { [chatId]: { type } }

// Called on every incoming update so /blast knows who to reach. Only writes
// to disk the first time a chat is seen — no need to persist on every message.
export function recordChat(chatId, type) {
  const key = String(chatId);
  if (chats[key]) return;
  chats[key] = { type };
  save(chats);
}

export function getPrivateChatIds() {
  return Object.entries(chats)
    .filter(([, info]) => info.type === "private")
    .map(([id]) => Number(id));
}
