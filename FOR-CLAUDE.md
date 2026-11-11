# FOR CLAUDE: how to read and update Creator Board

You are helping a creator who uses **Creator Board**, a local app on their computer for planning, making and posting videos on YouTube, Instagram and Facebook. Everything is stored in ONE plain JSON file. Your job is to keep that file correct and up to date. Nothing here uses the internet or a cloud.

## 1. Standing rule (do this every time)
Whenever the creator does anything about their videos (an idea is researched, a video is made, something is posted, a date changes, new numbers are known), **update the data file in the same turn, without being asked, and tell them in one short line what you changed.** Example: "Creator Board updated: marked 'Why is the sky blue?' as made." Never say you updated something unless you really saved it.

## 2. Where the data is
1. Read `%APPDATA%\Creator Board\config.json` (older installs: `%APPDATA%\Hot Explainer HQ\config.json`). Its `home` value is the data folder. (Mac: `~/Library/Application Support/Creator Board/config.json`.)
2. If that file is missing, the default is `Documents\Creator Board`.
3. The data file is `<home>\data\hq-data.json`. Backups are in `<home>\backups`. This guide is saved next to the data file as `FOR-CLAUDE.md`.

The app window reloads the file by itself within a few seconds of a change.

## 3. How to edit safely
1. Copy `hq-data.json` into `<home>\backups\` first (name it `hq-data-YYYYMMDD-HHMMSS-claude.json`).
2. Edit the JSON and keep it **valid** (double quotes, no trailing commas). Save as UTF-8 (without a BOM if you can; Windows PowerShell's `Set-Content -Encoding UTF8` adds one, which the app tolerates). Keep every existing field.
3. Never change an item's `id`. New ids must be unique (for example `i-` plus a random string).
4. Dates are `YYYY-MM-DD`. Numbers are real numbers, not strings. Unknown numbers are `null`.
5. Never delete an item: move it into the `trash` array instead (the app can restore it).

## 4. The shape of the file
```json
{
  "meta": { "app": "Creator Board", "version": 1, "created": "2026-01-01" },
  "settings": {
    "channelName": "My channel", "handle": "", "style": "",
    "schedule": { "long": [2, 5], "short": [0,1,2,3,4,5,6] },
    "defaults": {}, "seriesNames": {}, "numberedSeries": [],
    "rules": ["..."], "lastDaily": "2026-01-01"
  },
  "snapshots": [ { "date": "2026-01-01", "youtube": 10, "instagram": 5, "facebook": 20 } ],
  "targets": [ { "id": "t1", "name": "...", "target": "...", "current": "..." } ],
  "items": [ /* one object per video, see below */ ],
  "trash": [ /* deleted items */ ]
}
```
- `settings.schedule`: weekdays (0 = Sunday ... 6 = Saturday) used by Auto-plan. `numberedSeries`: series ids whose videos get an episode number (#1, #2...). `seriesNames`: maps a series id to its display name. `defaults`: optional presets for new items (`youtube` and `other`, each with `kind`, `series`, `category`, `durationSec`, `platforms`).
- `snapshots`: follower or subscriber counts by date (one per day at most). `lastDaily` is the date of the last Daily update.

### An item (one video)
```json
{
  "id": "i-abc123",
  "title": "Why is the sky blue?",
  "kind": "short",                       // "long" or "short"
  "series": "weekly-facts",              // optional series id ("" if none)
  "number": 4,                           // optional episode number, or null
  "category": "science",                 // free text topic
  "platforms": ["youtube", "instagram", "facebook"],   // any of these three
  "status": "idea",                      // idea | script | made | ready | posted
  "plannedDate": "2026-01-15",           // "" if not planned
  "durationSec": 35,
  "style": "", "hook": "", "notes": "", "sources": "", "videoPath": "",
  "perf": {
    "youtube": { "posted": true, "date": "2026-01-15", "url": "https://...", "views": 120, "likes": 9, "comments": 1,
                 "history": [ { "date": "2026-01-16", "views": 120, "likes": 9, "comments": 1 } ] }
  },
  "checks": { "watched": false, "honestTitle": false, "sources": false, "aiLabel": false, "kids": false },
  "createdAt": "2026-01-10"
}
```
**How the app decides the column on a platform's board:**
- *Posted* if `perf[platform].posted` is true.
- else *Ready to post* if `status` is `made`, `ready` or `posted`.
- else *To make*.
- `status` becomes `"posted"` only when the item is posted on **all** of its platforms. If it is posted on some, keep `status` at `made` or `ready`.
- `perf` only needs entries for platforms where it was posted (or has numbers).

## 5. Common jobs
- **Add an idea:** append an item with `status: "idea"`, a title, `kind`, `platforms`, and `perf: {}`.
- **Researched a video:** put the facts in `notes`, the links in `sources`, fix the `title` if the sources disagree.
- **Video made:** `status: "ready"`, set `videoPath` and `durationSec`.
- **Posted:** set `perf.<platform>` = `{ "posted": true, "date": "<today>", "url": "...", "views": null, "likes": null, "comments": null }`. If it is now posted everywhere, set `status: "posted"`.
- **New numbers:** update `views`, `likes`, `comments`, and add or replace today's entry in `history`. Add or update today's entry in `snapshots`, and set `settings.lastDaily` to today.
- **Plan dates:** set `plannedDate` (long videos usually Tue and Fri, one short a day), or tell the creator to press **Auto-plan** in the app.
- **Delete:** remove the item from `items` and add it to `trash`.

## 6. Reading numbers from the platforms
Only if the creator asks. They must be signed in in the browser you use. **Never type a password, never sign in for them.** If the platform asks for a login, tell them to sign in and wait.

## 7. Facts and quality (the creator's rules live in `settings.rules`)
Every fact must be looked up in a reliable source (official sites, encyclopaedias, published studies, major news), not written from memory, and the links go in `sources`. If a fact cannot be confirmed, drop it. Never copy another creator's script or art.
