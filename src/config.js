import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see .env.example)`);
  }
  return value;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  googleServiceAccountKeyPath: required("GOOGLE_SERVICE_ACCOUNT_KEY_PATH"),
  googleCalendarId: required("GOOGLE_CALENDAR_ID"),
  ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen3",
  adminChatId: process.env.ADMIN_CHAT_ID || null,
  timezone: process.env.TIMEZONE || "Australia/Melbourne",
  calendarPublicUrl:
    process.env.CALENDAR_PUBLIC_URL ||
    "https://calendar.google.com/calendar/u/0?cid=OWtxZWQ3cWMyczVrYjE5ZWtpcHRsOHZuMDhAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ",
};
