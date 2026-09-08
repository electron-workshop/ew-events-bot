# EW Events Bot — Overview

## Problem

EW keeps a shared Google Calendar of events people might be interested in:
https://calendar.google.com/calendar/u/0?cid=OWtxZWQ3cWMyczVrYjE5ZWtpcHRsOHZuMDhAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ

Today, adding an event means inviting the person as a calendar collaborator, which requires them to have a Google account. This project replaces that with a Telegram bot command: someone sends an event link, the bot extracts the details and adds it to the calendar — no Google account needed on their end.

## How it works

1. A dedicated Telegram bot (separate from `@electronworkshop_bot`, which is already used by the Superbridge Telegram relay via mautrix-telegram and cannot share a bot token with another listener — Telegram only allows one active poller/webhook per token) exposes `/add_event <url>`.
2. The bot process runs as a container on Coolify.
3. The bot fetches the URL (plain HTTP fetch / curl).
4. If the page publishes a schema.org Event block as JSON-LD — Eventbrite, Humanitix, Luma and most event platforms do, for search and social previews — the title, description, dates, times, location and registration link are read straight out of it. This is instant and exact: it's the page's own data, not an interpretation of its text. See `src/services/eventFromJsonLd.js`.
5. If the page publishes no such block, the bot doesn't guess. It offers a button to open the Mini App, where the person fills the details in on a form and it lands on the same calendar.
6. The bot replies to the sender with the extracted fields and a confirm/edit inline button.
7. On confirm, the bot writes the event to the Google Calendar via a Google service account (shared onto the calendar with edit permission) and:
   - confirms back to the sender with the final event details
   - notifies the EW admin, unless the admin was the one who sent the request

## No language model

The bot used to send page text to a local Ollama/Qwen3 instance to extract event
details. It no longer does, and there is no LLM anywhere in this project.

Structured data covers most real event links, and it's strictly better than a
model reading the same page: instant, deterministic, and impossible to
hallucinate a date out of. For pages without it, a form the person fills in
beats a guess they then have to check — and the Mini App has one.

This also means the bot has no GPU dependency and no home-lab dependency, which
is what lets it run as a small container anywhere.

## Infrastructure

- **Bot process**: dedicated Telegram bot `@electronevents_bot` (not
  `@electronworkshop_bot`), a Node container deployed on Coolify.
- **Persistent state**: the bot's JSON files (`knownChats.json`, `reminders.json`,
  `feedback.json`) live in `DATA_DIR`, which **must** be a mounted volume. Without
  one, every redeploy loses everyone who has messaged the bot, all their
  reminders, and any untriaged feedback.
- **Calendar writes**: Google Calendar API via a service account. Service accounts and Calendar API usage are free at this scale — no billing account required, generous free quota. The service account is shared onto the target calendar (like sharing with a person) with "Make changes to events" permission. The key is supplied as `GOOGLE_SERVICE_ACCOUNT_JSON` in a container, or `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` on a VM.
- **One poller per token**: Telegram allows only one process to receive updates
  for a bot token. If the bot is running on Coolify, it must not also be running
  under pm2 anywhere else, or the two will fight over updates.

## The command menu

The list behind Telegram's menu button is published by the bot itself, from
`src/telegram/commandMenu.js`, on every startup. Adding a `bot.command(...)` and
a line in that file is all it takes to publish a command; there is no BotFather
`/setcommands` step any more.

`/blast` and `/release` are deliberately not in it. Both message every user, so
they stay unlisted and get typed from memory. The menu is not what gates them:
`isAdmin.js` does, and it does not care whether a command is listed.

A failure here is logged and swallowed. The menu is cosmetic, the commands still
work when typed, and a Telegram hiccup must not stop the bot starting.

## Related: the web app

`../ew-events-webapp` is the same calendar as a web page and a Telegram Mini
App, deployed separately to a Coolify VPS. It shares this project's calendar,
its bot token (for verifying Mini App signatures — only one process may
*receive* updates, but any number may verify and send) and copies of
`src/services/`.

It is where a link the bot can't read gets finished by hand, so the two are a
pair: the bot handles the common case in the chat, the app handles the rest.

A fix to `calendar.js`, `fetchPage.js`, `eventFromJsonLd.js` or `eventTime.js`
should be made in both projects. The web app also keeps an `extractEvent.js`
for an optional Ollama fallback; the bot has no equivalent. See that project's
`docs/overview.md`.

## Open items / not yet decided

- Final bot username/handle (to be created via BotFather).
- Whether `/add_event` is restricted to certain Telegram users/groups or open to anyone who can message the bot.
- Screenshot submission for pages with no readable details. The Mini App's form covers this case for now.
- Exact confirm/edit UX (inline keyboard button behavior, what "edit" lets you change).
- GCP project + service account creation (walkthrough pending).
