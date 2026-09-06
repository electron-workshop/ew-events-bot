import { config } from "../config.js";
import { log } from "../logger.js";
import { version } from "../version.js";
import { parseChangelog } from "./changelog.js";

// The web app has no database and can't reach this bot — it's the bot that
// makes outbound calls, not the other way round. So the bot tells the web app
// what version it's running and what shipped in it, and the web app just
// remembers the last thing it was told.
//
// Repeated rather than sent once at startup because the web app holds this in
// memory: a redeploy over there forgets, and this is what puts it back.
const INTERVAL_MS = 60 * 60 * 1000;

async function announce() {
  // Unreleased notes are still being written and aren't for the public.
  const entries = parseChangelog().filter(
    (entry) => entry.version.toLowerCase() !== "unreleased"
  );

  try {
    const response = await fetch(new URL("/api/version", config.webAppUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Secret": config.versionPingSecret,
      },
      body: JSON.stringify({ version, changelog: entries }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      log("version", `web app rejected the ping: ${response.status} ${response.statusText}`);
      return;
    }
    log("version", `told the web app we're on v${version}`);
  } catch (error) {
    // The web app being down must never take the bot with it.
    log("version", `couldn't reach the web app: ${error.message}`);
  }
}

export function startVersionAnnouncer() {
  if (!config.webAppUrl || !config.versionPingSecret) {
    log("version", "not announcing — WEB_APP_URL or VERSION_PING_SECRET isn't set");
    return;
  }
  announce();
  setInterval(announce, INTERVAL_MS);
  log("version", `announcing v${version} to ${config.webAppUrl} hourly`);
}
