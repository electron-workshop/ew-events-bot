# Releasing

Features get batched into a version instead of shipping one by one, so users get
one readable announcement rather than a message every time something changes.

## Where the version lives

- `package.json` `version` is the source of truth. `src/version.js` reads it.
- `CHANGELOG.md` holds the notes for every version, newest first.
- A git tag (`v0.2.0`) marks the commit that version was cut from.
- The web app's `public/versions.json` is a copy of the two above, pushed there
  by `npm run sync-versions` so its version panel has something to show.

## Day to day

Work on a branch per issue, merge to `main` when it's good. Add a line to the
`## [Unreleased]` section of `CHANGELOG.md` as part of that work, while you still
remember what changed.

Write those lines for the people using the bot, not for whoever wrote the code.
"Multi-day events now add every day" is useful. "Refactor eventTime parser" isn't.

## Cutting a release

```
npm run release minor      # 0.1.0 -> 0.2.0
npm run release patch      # 0.1.0 -> 0.1.1, for a bug fix on its own
npm run release 0.4.0      # explicit
```

That bumps `package.json`, moves the `Unreleased` notes under the new version
with today's date, commits, and tags. It stops if the working tree is dirty, if
there's nothing under `Unreleased`, or if the tag already exists. It does not
push.

It also writes the new version and the parsed changelog into the web app's
`public/versions.json`, which is what its version panel shows. That's a
different repo — assumed to be `../ew-events-webapp`, override with
`WEBAPP_DIR` — so it leaves that checkout dirty for you to commit. If the
directory isn't there it prints the JSON instead, and `npm run sync-versions`
redoes it on its own at any time.

Then:

```
git push && git push --tags                      # here
cd ../ew-events-webapp && git add public/versions.json && git commit && git push
```

Forgetting the second line isn't fatal — the panel just keeps showing the
previous bot version until you push it.

Deploy (Coolify redeploys on the push), then run `/release` in
the bot as the admin. It reads the current version's changelog section, shows you
a preview, and sends it to everyone who has DM'd the bot once you confirm. It's
the same preview and confirm flow as `/blast`.

`/release` reads the version the running process started with, so deploy before
announcing, otherwise it will offer the old version's notes.

## Ship fixes, batch features

Don't hold a bug fix back waiting for unfinished features. Cut a patch release
for it on its own. Batching is for features.
