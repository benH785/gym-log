# Gym Log

A phone-first, installable web app for the **Stretch/Contraction v4.4** programme. It shows the whole training week, lets you log any set on any day, swaps exercises to suit home kit, and keeps a running list of what's left.

## Use it

1. Open the GitHub Pages URL in **Safari** on the iPhone.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the home screen. It runs full-screen and works offline.

Your log is stored **on the phone only** (browser storage for this site). Nothing is sent anywhere and nothing is stored in this repo. Use **Settings > Export backup** regularly and keep the file in iCloud Drive; **Restore from file** brings it back on a new phone.

## What's in it

| File | Purpose |
|---|---|
| `index.html` | Layout, styles, iPhone home-screen settings |
| `app.js` | Logging, prefill and progression hints, swaps, rest timer, backup/restore |
| `plan.js` | The v4.4 programme: sessions, exercises, sets, rep ranges, rest, kit, swaps |
| `sw.js` | Offline cache. **Bump `VERSION` on every release** so phones pick up changes |
| `manifest.webmanifest`, `icons/` | Install metadata and icons |
| `fonts/` | Barlow and Barlow Condensed (SIL Open Font License) |

## Changing the programme

Edit `plan.js`, bump `VERSION` in `sw.js`, commit and push. The app shows "A new version is ready" next time it's opened with a connection.

Logged sets are keyed by exercise id (`bench_0` = bench, top set), so keep existing `id`s when renaming an exercise or its history won't line up.

## Data format (for the native app later)

`localStorage["sc44:data"]` and the backup file's `data` field:

```json
{
  "v": 1,
  "weeks": { "2026-11-09": { "sets": { "bench_0": { "w": 120, "r": 7, "x": null, "v": "Barbell bench press", "d": "2026-11-10", "loc": "work" } } } },
  "settings": { "blockStart": "2026-11-09", "homeKit": ["dumbbells", "bench"] },
  "lastBackup": "2026-11-10T12:00:00.000Z"
}
```

`w` kg (added kg for pull-ups), `r` reps, `x` partials or rest-pause reps on the top set, `v` exercise actually done (plan or swap), `d` date logged, `loc` work or home. Weeks are keyed by their Monday.
