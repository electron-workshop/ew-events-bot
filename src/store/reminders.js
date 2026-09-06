import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { log } from "../logger.js";
import { dataFile } from "./dataDir.js";

const FILE_PATH = dataFile("reminders.json");

export const LEAD_TIME_MS = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

export const LEAD_LABELS = {
  "1h": "1 hour",
  "1d": "1 day",
  "1w": "1 week",
};

function load() {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      log("reminders", `failed to read ${FILE_PATH}: ${error.message}`);
    }
    return [];
  }
}

function save(reminders) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(reminders, null, 2));
}

let reminders = load();

export function addReminder({ eventId, eventSummary, eventStart, eventHtmlLink, chatId, leadTime }) {
  const reminder = {
    id: crypto.randomUUID().slice(0, 8),
    eventId,
    eventSummary,
    eventStart, // ISO string
    eventHtmlLink,
    chatId,
    leadTime, // "1d" | "1w"
    notified: false,
    createdAt: new Date().toISOString(),
  };
  reminders.push(reminder);
  save(reminders);
  log("reminders", `added reminder ${reminder.id} for "${eventSummary}" (${leadTime}) in chat ${chatId}`);
  return reminder;
}

export function getDueReminders(now = new Date()) {
  return reminders.filter((r) => {
    if (r.notified) return false;
    const eventStart = new Date(r.eventStart);
    const triggerAt = new Date(eventStart.getTime() - LEAD_TIME_MS[r.leadTime]);
    return now >= triggerAt;
  });
}

export function markNotified(id) {
  const reminder = reminders.find((r) => r.id === id);
  if (reminder) reminder.notified = true;
  save(reminders);
}

export function getRemindersForChat(chatId) {
  return reminders.filter((r) => !r.notified && String(r.chatId) === String(chatId));
}

export function removeReminder(id) {
  const before = reminders.length;
  reminders = reminders.filter((r) => r.id !== id);
  const removed = reminders.length !== before;
  if (removed) save(reminders);
  return removed;
}

// Drop reminders for events that have already happened or were notified,
// so the file doesn't grow forever.
export function pruneStaleReminders(now = new Date()) {
  const before = reminders.length;
  reminders = reminders.filter((r) => !r.notified && new Date(r.eventStart) > now);
  if (reminders.length !== before) {
    save(reminders);
    log("reminders", `pruned ${before - reminders.length} stale reminder(s)`);
  }
}
