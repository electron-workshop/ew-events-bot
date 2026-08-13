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
  // A few people who get broadcasts first, so the real thing can be checked on
  // more than one chat before it goes out. Numeric Telegram IDs, comma
  // separated. Empty is fine — the tester button just doesn't appear.
  betaTesters: (process.env.BETA_TESTERS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  // Optional: without these, /feedback tells people it isn't set up rather
  // than the bot refusing to start.
  githubToken: process.env.GITHUB_TOKEN || null,
  githubRepo: process.env.GITHUB_REPO || "electron-workshop/ew-events-bot",
  timezone: process.env.TIMEZONE || "Australia/Melbourne",
  calendarPublicUrl:
    process.env.CALENDAR_PUBLIC_URL ||
    "https://calendar.google.com/calendar/u/0/newembed?src=9kqed7qc2s5kb19ekiptl8vn08@group.calendar.google.com&ctz=Australia/Sydney&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&mode=MONTH",
};
