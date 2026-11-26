# Gym Log

A phone-first, installable web app for the **Stretch/Contraction v4.4** programme. It shows the whole training week, lets you log any set on any day, swaps exercises to suit home kit, and keeps a running list of what's left.

## Use it

1. Open the GitHub Pages URL in **Safari** on the iPhone.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the home screen. It runs full-screen and works offline.

Your log is stored **on the phone only** (browser storage for this site). Nothing is sent anywhere and nothing is stored in this repo. Use **Settings > Export backup** regularly and keep the file in iCloud Drive; **Restore from file** brings it back on a new phone.

### Two gyms

The gym is chosen in each exercise's **Swap** list. Machine and cable exercises (anything whose kit includes `machines` or `cable`) are listed twice, e.g. "Hack squat · Work" and "Hack squat · Home", because their stacks are calibrated differently: each version keeps its own pre-filled weights, "last top set" line and add-load hints, with the other gym's latest top set shown underneath for reference. Free-weight exercises are listed once and share their history between gyms. The card shows a **Work machine** / **Home machine** tag.

What you pick stays picked until you change it; with no pick, an exercise shows whatever you last logged for it, else the plan exercise at Work. Picking only redraws that card. The programme's plan weights are work-gym numbers, so a machine exercise's Home version starts blank until you've logged it there once.

### Entering numbers

Weight, reps and the +P/+RP count are entered on the app's own number pad (digits, −/+ 2.5 kg or −/+ 1 rep, delete, **Next**, **Log set**). The iPhone keyboard is never used for them, which also stops iOS's Shake to Undo ("Undo Typing") popping up when you take the phone out of your pocket. Tapping a logged set's field edits it; the change saves when you tap **Done** or anywhere else.

### Weeks

The app moves to the new week by itself when it's next opened, including when iOS resumes it without a fresh load (checked on resume, focus and every 30 seconds). If you go to another week on purpose, it stays there and shows a warning that sets you tick are saved to that week. If sets were ever ticked on one week's days but saved under an earlier week, a banner offers to move them; any set already logged in its own week stays put.

### Rest times

Every set you tick records its rest: the time since you ticked the previous set of the same exercise that day. It runs tick to tick, so it includes doing the set itself and any superset partner. Gaps under 20 s (sets ticked together) or over 20 minutes (a break) aren't counted. The set row shows it, e.g. "Rest 2:41". Sets logged before 1.5 have their rest worked out from their tick times.

**Insights** shows, for this week, the last 4 weeks or everything:

- **Rest vs plan**: per exercise, the plan's time between sets (its rests in the superset plus about 45 s per set) against your typical (median) time, flagged when more than 30 s apart.
- **Rest vs reps**: for each exercise, back-off sets at the weight you've used most, as a dot chart of reps against rest. From 3 sets it draws the chart; from 6 it adds a trend line and says whether more rest has meant more reps, and by roughly how many per extra 30 s. Tap a dot for its details; **Show the sets** lists them.

### Your own exercises

**Swap > + Add your own…** on any exercise (or **Settings > My exercises > Add an exercise**): name it, say whether it's a machine or cable (then it gets Work and Home versions), and optionally switch to it straight away. Settings lists your own exercises with **Remove**.

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
  "weeks": { "2026-11-09": { "sets": { "bench_1": { "w": 107.5, "r": 9, "x": null, "v": "Barbell bench press", "d": "2026-11-10", "t": "2026-11-10T12:04:10.000Z", "loc": null, "rest": 190 } } } },
  "settings": {
    "blockStart": "2026-11-09",
    "custom": { "hack": [{ "n": "Belt squat", "machine": true }] },
    "choice": { "hack": { "v": "Belt squat", "loc": "home" }, "bench": { "v": "DB bench press", "loc": null } }
  },
  "lastBackup": "2026-11-10T12:00:00.000Z"
}
```

`w` kg (added kg for pull-ups), `r` reps, `x` partials or rest-pause reps on the top set, `v` exercise actually done (plan, swap or your own), `d` date logged, `t` time logged (from 1.2), `loc` work or home, `rest` seconds since the previous set of the same exercise that day (from 1.5; `null` when there wasn't one within 20 s–20 min; missing on older sets, where it's worked out from `t`). Weeks are keyed by their Monday. `loc` is `work`/`home` for machine and cable exercises and `null` for free weights (sets from 1.0–1.2 always carry a gym). Machine history is matched on `v` and `loc`; free-weight history on `v` only. `custom` holds exercises you added per slot; `choice` holds the exercise and gym picked in Swap.
