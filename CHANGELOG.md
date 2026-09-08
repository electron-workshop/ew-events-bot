# Changelog

Notes for each released version of the bot.

`/release` broadcasts the `### Highlights` section only: three or four short
lines, written for the people using the bot. Everything else in a version's
section is the full record, and the broadcast links here for it. Without a
Highlights section the whole entry gets sent, which is usually too long.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- The command menu in Telegram now lists every command people can use, `/feedback` and `/settings` included. The bot publishes the list itself on startup, so the menu can no longer fall behind what the code actually does.

## [0.2.0] - 2026-09-06

### Highlights

- A calendar app you can open in Telegram or in a browser
- Multi-day events now work
- Event links from most sites are read instantly
- `/feedback` to report a bug or suggest an idea
- `/settings` to turn update messages off

### Added

- A calendar app. Browse what's coming up, and add events the bot can't read on its own. Open it from `/start`, or visit calendar.electronworkshop.com.au.
- `/settings` to turn off update messages. Event reminders are not affected.
- `/feedback` to send the EW team a bug or an idea, with your name or anonymously.
- Multi-day events are added to every day they run, not just the first.
- Finish times come from the event page instead of always assuming two hours.
- Events running past midnight now end the next morning.
- `end_date` and `end_time` can be set when editing.

### Fixed

- Event details are now read from far more sites. Only events labelled generically were being recognised, so a talk tagged as an "education event" was missed.
- All-day events no longer start and end on the same date, which Google Calendar treats as zero length.
- Editing works whether you reply to the bot or send a normal message. Only a reply worked before.
- The bot always answers a direct message instead of ignoring what it didn't understand.
- A dropped connection no longer makes Confirm, Edit and Cancel do nothing.
- Underscores, asterisks and ampersands in event details no longer break the bot's reply.
- If sending updated details fails, you can send them again without tapping Edit first.

### Changed

- Events are read from the page's own published details, so previews are instant and exact. Pages without them hand you the app's form instead of a guess.
- Dates and times the bot can't read are flagged when editing, with the format it needs. They used to be accepted and ignored.
- Unrecognised messages get a useful reply. A mistyped command suggests the real one.
- Events waiting for confirmation stay open for 2 hours instead of 30 minutes.

## [0.1.0] - 2026-07-15

### Added

- `/add_event <link>` adds an event to the shared EW calendar. The bot reads the page and asks you to confirm before writing anything.
- `/add_event` on its own waits for you to send the link next.
- `/today`, `/tomorrow`, `/week` and `/month` show what's coming up.
- `/view` gets the calendar's link.
- Tap 🔔 on any listed event to get a reminder before it starts.
- `/reminders` shows and cancels the reminders you've set.
- `/blast` broadcasts to everyone who has DM'd the bot, with a preview and confirm step. Admin only.
