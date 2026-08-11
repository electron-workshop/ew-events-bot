# Changelog

Notes for each released version of the bot. The `/release` admin command reads
the top released section from this file and broadcasts it, so write these
entries for the people using the bot, not for the person who wrote the code.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-07-15

### Added

- `/add_event <link>` — send an event link and the bot extracts the details and adds it to the shared EW calendar, with a confirm step before anything is written.
- `/add_event` on its own — the bot waits for you to send the link next.
- `/today`, `/tomorrow`, `/week`, `/month` — see what's coming up.
- `/view` — get the calendar's link.
- Tap 🔔 on any listed event to get a reminder before it starts.
- `/reminders` — see and cancel the reminders you've set.
- `/blast` — admin-only broadcast to everyone who has DM'd the bot, with a preview and confirm step.
