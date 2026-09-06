import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see .env.example)`);
  }
  return value;
}

// The service account can arrive either way. A file path suits a VM where the
// key sits on disk; the raw JSON suits a container platform like Coolify,
// where there is no file to mount and secrets are set as env vars.
function googleCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
  }
}

const credentials = googleCredentials();
if (!credentials && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
  throw new Error(
    "Set either GOOGLE_SERVICE_ACCOUNT_JSON (the key's contents) or " +
      "GOOGLE_SERVICE_ACCOUNT_KEY_PATH (a path to it). See .env.example."
  );
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  googleServiceAccountCredentials: credentials,
  googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || null,
  googleCalendarId: required("GOOGLE_CALENDAR_ID"),
  // The Mini App, for pages the bot can't read on its own and for browsing the
  // calendar. Unset, the bot simply never offers the button.
  miniAppUrl: process.env.MINI_APP_URL || null,
  // Where to tell the web app what version the bot is on, so its version panel
  // isn't guessing. Defaults to the Mini App's own origin, since that's the
  // same deployment. Both this and the secret must be set to announce at all.
  webAppUrl: process.env.WEB_APP_URL || process.env.MINI_APP_URL || null,
  versionPingSecret: process.env.VERSION_PING_SECRET || null,
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
  // Linked at the bottom of a release announcement. Leave unset while the repo
  // is private — the link would 404 for everyone who isn't a collaborator.
  changelogUrl: process.env.CHANGELOG_URL || null,
  timezone: process.env.TIMEZONE || "Australia/Melbourne",
  calendarPublicUrl:
    process.env.CALENDAR_PUBLIC_URL ||
    "https://calendar.google.com/calendar/u/0/newembed?src=9kqed7qc2s5kb19ekiptl8vn08@group.calendar.google.com&ctz=Australia/Sydney&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&mode=MONTH",
};
