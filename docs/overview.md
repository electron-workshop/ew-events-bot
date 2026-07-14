# EW Events Bot — Overview

## Problem

EW keeps a shared Google Calendar of events people might be interested in:
https://calendar.google.com/calendar/u/0?cid=OWtxZWQ3cWMyczVrYjE5ZWtpcHRsOHZuMDhAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ

Today, adding an event means inviting the person as a calendar collaborator, which requires them to have a Google account. This project replaces that with a Telegram bot command: someone sends an event link, the bot extracts the details and adds it to the calendar — no Google account needed on their end.

## How it works (Phase 1)

1. A dedicated Telegram bot (separate from `@electronworkshop_bot`, which is already used by the Superbridge Telegram relay via mautrix-telegram and cannot share a bot token with another listener — Telegram only allows one active poller/webhook per token) exposes `/add_event <url>`.
2. The bot process runs under pm2 on one Proxmox CT.
3. The bot fetches the URL (plain HTTP fetch / curl).
4. The page content is sent to a local LLM (Ollama running Qwen3 on a separate GPU-equipped CT) to extract: title, description, date, time, location, registration link.
5. The bot replies to the sender with the extracted fields and a confirm/edit inline button.
6. On confirm, the bot writes the event to the Google Calendar via a Google service account (shared onto the calendar with edit permission) and:
   - confirms back to the sender with the final event details
   - notifies the EW admin, unless the admin was the one who sent the request

## Phase 2 (later, not in initial build)

If the curl fetch fails or the LLM can't extract complete details (e.g. JS-rendered event pages like some Facebook/Meetup/Eventbrite listings), the bot asks the sender to instead paste the event details as text or send a screenshot. Screenshot handling will need a vision-capable model (Qwen3 is text-only), so this may require adding a second model to the Ollama CT when we get there.

## Infrastructure

- **Bot process**: new dedicated Telegram bot (not `@electronworkshop_bot`), Node process managed by pm2, on one Proxmox CT.
- **LLM extraction**: Ollama running Qwen3 on a separate Proxmox CT with GPU passthrough.
- **Calendar writes**: Google Calendar API via a service account. Service accounts and Calendar API usage are free at this scale — no billing account required, generous free quota. The service account is shared onto the target calendar (like sharing with a person) with "Make changes to events" permission.

## Open items / not yet decided

- Final bot username/handle (to be created via BotFather).
- Whether `/add_event` is restricted to certain Telegram users/groups or open to anyone who can message the bot.
- Exact confirm/edit UX (inline keyboard button behavior, what "edit" lets you change).
- GCP project + service account creation (walkthrough pending).
