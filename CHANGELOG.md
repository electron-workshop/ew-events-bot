# Changelog

Notes for each released version of the bot.

`/release` broadcasts the `### Highlights` section only — three or four short
lines, written for the people using the bot. Everything else in a version's
section is the full record, and the broadcast links here for it. Without a
Highlights section the whole entry gets sent, which is usually too long.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Highlights

- Multi-day event support added
- `/feedback` - tell the EWorkshop team about a bug or an idea
- `/settings` - choose whether you get these update messages

### Added

- `/settings` — turn off the messages the bot sends when it gets new features. The first one you receive has buttons to choose right there; after that every one has a line at the bottom reminding you `/settings` exists. Turning them off doesn't affect event reminders you've set.
- `/feedback` — tell the EW team about a bug or an idea, either as `/feedback your message` or on its own and the bot waits for your next message. You choose whether to send it with your name or anonymously, and confirm before anything is passed on. It goes to the admin, who decides whether it becomes a GitHub issue and can rewrite it first. Your name and Telegram ID never appear on the issue either way.
- Multi-day events. A conference running 9–5 across two days now goes in as 9–5 on each day, so it shows up under both days in `/today` and `/week` and you can set a reminder for either one. Previously only the first day was added.
- Events now use the finish time from the page instead of always assuming they run for two hours. Where the page doesn't say, the preview marks the end time as estimated so you can correct it.
- Events running past midnight, like a launch night from 8pm to 1am, now end on the following morning rather than the same evening.
- `end_date` and `end_time` are fields you can set when editing, for when the bot misses that an event runs across several days or gets the finish time wrong.

### Fixed

- All-day events are no longer written with the same start and end date, which Google Calendar treats as an event of no length.
- Editing an event works whether you reply to the bot's message or just send the corrected details as a normal message. Before, only a proper Telegram reply worked and anything else got no response at all.
- The bot always answers a direct message now, instead of silently ignoring anything it didn't understand.
- A dropped connection while tapping Confirm, Edit or Cancel no longer makes the button do nothing.
- Event details containing an underscore, asterisk or ampersand no longer break the message the bot sends back. A link with `utm_source=` in it was enough to do this.
- If the bot fails to send the updated details, you can just send them again instead of tapping Edit a second time.

### Changed

- When editing, a date or time the bot can't read (like `time: 5pm`) is now called out, saying what format it needs. It used to be accepted and then quietly ignored.
- The bot says something useful when it doesn't understand you, instead of "Not sure what to do with that". A mistyped command suggests the real one, and sending a bare event link tells you the exact command to send.
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
