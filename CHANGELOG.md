# Changelog

Notes for each released version of the bot. The `/release` admin command reads
the top released section from this file and broadcasts it, so write these
entries for the people using the bot, not for the person who wrote the code.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Editing an event works whether you reply to the bot's message or just send the corrected details as a normal message. Before, only a proper Telegram reply worked and anything else got no response at all.
- The bot always answers a direct message now, instead of silently ignoring anything it didn't understand.
- A dropped connection while tapping Confirm, Edit or Cancel no longer makes the button do nothing.
- Event details containing an underscore, asterisk or ampersand no longer break the message the bot sends back. A link with `utm_source=` in it was enough to do this.
- If the bot fails to send the updated details, you can just send them again instead of tapping Edit a second time.

### Changed

- Events waiting for confirmation now stay open for 2 hours instead of 30 minutes.

## [0.1.0] - 2026-07-15

### Added

- `/add_event <link>` — send an event link and the bot extracts the details and adds it to the shared EW calendar, with a confirm step before anything is written.
- `/add_event` on its own — the bot waits for you to send the link next.
- `/today`, `/tomorrow`, `/week`, `/month` — see what's coming up.
- `/view` — get the calendar's link.
- Tap 🔔 on any listed event to get a reminder before it starts.
- `/reminders` — see and cancel the reminders you've set.
- `/blast` — admin-only broadcast to everyone who has DM'd the bot, with a preview and confirm step.
