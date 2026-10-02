# Evaluating Gloamhold

For clinicians, orthoptists and research groups deciding whether this is worth looking at, and
for anyone who wants to run it under a protocol and read the data it records.

> **Not a medical device.** Gloamhold is a hobby build. It has not been evaluated in any trial,
> it has no regulatory clearance anywhere, and nothing here is a claim that it improves vision.
> Dichoptic treatment for amblyopia is an active research area; the devices that are cleared
> for it (for example Luminopia and CureSight in the US) went through regulatory review this
> software has not. Using it with patients is the responsibility of the clinician or study team
> under their own ethics approval and local rules.

---

## What it presents

The phone shows two half-screen images, one per eye, through a Cardboard-style viewer. The
stronger eye's image has selected things drawn fainter; the weaker eye always gets everything at
full strength. Nothing is shown to one eye only unless *forced fusion* mode is chosen.

Every drawn thing belongs to one of these layers, decided in a single function (`alphaFor` in
`src/20-core.js`):

| Layer | Weaker eye | Stronger eye, *rebalance* (default) | Stronger eye, *forced fusion* |
|---|---|---|---|
| `world`, `player`, `hud` — terrain, the player's character, frame | full | full | full |
| `foe` — enemies, their shots, falling pieces | full | at the stronger-eye contrast | not shown |
| `item` — things collected | full | at the stronger-eye contrast | at the contrast, but never below `therapy.splitItemFloor` (0.35) |
| `clue` — things to find (hints, landing guides, signs) | full | at the stronger-eye contrast | not shown |

Terrain, the player and the corner brackets always reach both eyes at full strength, so there is
always something to fuse on. What sits on which layer in each game is listed in `CLAUDE.md`
(invariant 12).

There are five games behind one menu: an island dungeon crawler, a side-view truck game
(Gator Truck), a falling-blocks game (Jelly Blocks), a space-rock shooter and a top-down racer.
They are games first. Each is arranged so the per-eye layers carry things the player has to see
to play well.

## What "contrast" means here — read this before using any number

Each per-eye sprite is drawn over a uniform floor colour at a **blend alpha** *a*. The browser
blends in **gamma-encoded sRGB values**, so *a* scales the encoded difference from the floor
exactly, but **not** the luminance difference, which is what the eye responds to. A sprite drawn
at *a* = 0.40 keeps about **75%** of its full luminance Michelson contrast, not 40%.

`node tools/contrast-table.mjs` prints the fraction kept on an ideal sRGB display, as mean
(min–max) over the reference sprite colours:

| Background | alpha 1 | alpha 0.8 | alpha 0.6 | alpha 0.4 | alpha 0.3 | alpha 0.2 | alpha 0.1 | alpha 0.05 |
|---|---|---|---|---|---|---|---|---|
| Islands (dungeon floor) `#191e29` | 1 (1–1) | 0.96 (0.93–0.98) | 0.88 (0.83–0.95) | 0.75 (0.67–0.87) | 0.65 (0.55–0.8) | 0.51 (0.39–0.67) | 0.3 (0.21–0.43) | 0.16 (0.1–0.25) |
| Gator Truck (meadow sky) `#16202c` | 1 (1–1) | 0.95 (0.93–0.98) | 0.88 (0.83–0.95) | 0.74 (0.65–0.87) | 0.64 (0.53–0.79) | 0.49 (0.37–0.66) | 0.29 (0.19–0.42) | 0.15 (0.1–0.24) |
| Jelly Blocks (level 1 jar) `#141a26` | 1 (1–1) | 0.96 (0.94–0.99) | 0.9 (0.86–0.96) | 0.78 (0.7–0.89) | 0.69 (0.58–0.83) | 0.54 (0.43–0.71) | 0.32 (0.23–0.47) | 0.18 (0.12–0.27) |
| Space Rocks (field) `#0e1320` | 1 (1–1) | 0.97 (0.96–0.99) | 0.93 (0.89–0.97) | 0.83 (0.77–0.92) | 0.75 (0.66–0.87) | 0.61 (0.5–0.77) | 0.38 (0.28–0.54) | 0.21 (0.14–0.32) |
| Racer (city road) `#2c2f38` | 1 (1–1) | 0.92 (0.89–0.97) | 0.81 (0.74–0.91) | 0.65 (0.54–0.79) | 0.53 (0.42–0.69) | 0.39 (0.28–0.55) | 0.22 (0.14–0.33) | 0.11 (0.07–0.18) |

Two scales are available (`cfg.contrastScale`, on the grown-up screen and in a protocol):

- **`alpha`** (default): the setting is the blend alpha, as in every earlier version.
- **`luminance`**: the setting is the estimated fraction of full luminance contrast, averaged over
  the reference colours **on the dungeon floor**; the app finds the alpha that gives it. On the
  arcade games' backgrounds the fraction differs a little (see the table).

Every run records the setting, its scale, the alpha actually drawn (`strongAlpha`) and the
estimated luminance fraction (`contrastEndLumEst`). **None of these is a photometric
measurement.** Phone displays are not ideal sRGB displays; screen brightness, the viewer's lenses,
the barrel-distortion resampling (which softens small sprites towards the edge of the view) and
room light all change what reaches the eye. If luminance contrast matters to your question,
measure it on the device with a photometer.

## How contrast changes during play

- **Staircase** (if *adaptive staircase* is on): a segment finished without being hit multiplies
  the stronger-eye contrast by `therapy.stepDownFactor` (0.85); a hit multiplies it by
  `therapy.stepUpFactor` (1.18) plus `stepUpFloorBump`, quantised to `therapy.quantise` (0.05),
  never below `therapy.minContrast` (0.05). A *segment* is a dungeon room, or an arcade game's
  level part, wave or race quarter.
- **Child mode** caps step-ups at `session.stepUpsPerRoom` (1) per segment, so a struggling
  player is not pushed back to high contrast on every hit, and no failure ends a run.
- **Alignment check** (nonius): a vertical bar to the weaker eye, a horizontal bar to the stronger
  eye, a ring to both. "No horizontal bar" raises the contrast one step; "no vertical bar"
  (suppression) lowers it. Under a locked protocol the answer is recorded and nothing changes.
- **Easy setup** (the butterfly game): a descending staircase on a target shown to the stronger
  eye only, with three blank catch trials. Two or more presses on blanks discards the run. It is a
  detection threshold from a game, not a clinical measurement, and under a locked protocol it does
  not change the contrast.

Every value above is in `TUNING` (`src/30-tuning.js`). The full tuning in force is stored with
every run.

## Running it under a protocol

On the grown-up flat panel (*hold B on the game picker → Flat menus*), under **Study data**:

1. Set a **participant code**. One is generated at random. Use letters, digits, `- _ .`, never a name.
2. Load a **protocol**:

   ```json
   { "protocol": { "id": "STUDY-01", "lock": true,
       "cfg":    { "weakEye": "right", "strong": 0.6, "mode": "rebalance", "adapt": true,
                   "kidMode": true, "contrastScale": "luminance" },
       "tuning": { "therapy": { "stepDownFactor": 0.9 }, "session": { "minutes": 15 } } } }
   ```

   Only `weakEye`, `strong`, `mode`, `adapt`, `kidMode` and `contrastScale` can be set in `cfg`.
   `tuning` may set any number in `TUNING`. Anything else is rejected with a message.
3. With `"lock": true` the weaker eye, contrast and its scale, mode, staircase, child mode and
   session length are shown but cannot be changed, in the viewer or on the flat panel. The easy
   setup and the tuning panel are unavailable. Lens, eye separation, sound and voice stay adjustable
   for comfort. Unlocking means typing the protocol id.

## The data it keeps

Everything stays on the phone (`localStorage`). There is no account and no network request, apart
from loading the Google font. (Some phones' text-to-speech voices are online services; the app
only ever hands them its own fixed prompts, never anything the player did.) Runs shorter than `study.minRunSec` (20 s) are not kept; the
history keeps the newest `study.maxRuns` (500). A run cut short by closing the app is filed as
`interrupted` on the next launch.

Export from **Study data**: *Copy runs (CSV)*, *Copy segments (CSV)*, *Copy everything (JSON)* or
*Save everything as a file*. *Delete history* removes it from the phone.

### Runs CSV — one row per run

| Column | Meaning |
|---|---|
| `run_id`, `participant`, `protocol` | Identifiers. The participant code is whatever was set; never a name. |
| `build` | App version, commit and build time. |
| `started_at`, `ended_at` | ISO timestamps from the phone's clock. |
| `end` | `won`, `ended` (lost / finished), `session-end`, `left` (back to the menu), `replaced` (a new run started), `quit`, `interrupted` (app closed). |
| `activity` | `islands`, `truck`, `blocks`, `rocks` or `race`. |
| `level`, `island` | Arcade level; island number (islands only). |
| `duration_sec` | Time the game was actually running. Paused or backgrounded time does not count. |
| `weak_eye`, `mode`, `adaptive`, `child_mode` | Settings in force at the end. |
| `contrast_scale` | `alpha` or `luminance`: what the three contrast columns mean. |
| `contrast_start`, `contrast_end`, `contrast_best` | Stronger-eye contrast at the start, at the end, and its lowest value in the run. |
| `contrast_end_lum_est` | Estimated luminance fraction at the end (see above), whatever the scale. |
| `segments`, `segments_clean` | Segments entered, and how many were finished without a hit. |
| `hits`, `knockdowns` | Hits taken; child-mode stand-ins for losing. |
| `steps_down`, `steps_up` | Staircase steps taken. |
| `exposure_*_sec`, `exposure_any_frac` | Seconds during which the `foe`, `item` or `clue` layer had something on it, and the fraction of the run anything did. **Not an outcome measure**, only whether the game gave the weaker eye something to do. |
| `nonius_checks`, `nonius_both`, `nonius_strong_gone`, `nonius_weak_gone` | Alignment checks done, and how often each answer was given. |
| `won`, `stars_gained`, `tuning_id` | Outcome, reward, and the key into `tunings` in the JSON export. |

### Segments CSV — one row per segment

`run_id, participant, activity, index, name, in_sec, cleared_sec, clean, hits_taken,
contrast_at_start`. A segment is a dungeon room ("The Crossing"), an arcade level part
("Blocks level 2 part 3"), a wave or a race quarter.

### JSON export

`{ format, version, exportedAt, build, participant, protocol, locked, note, runs[], tunings{} }`.
Each run carries everything in the CSV, plus the contrast trail (`contrastTrail`: seconds and
contrast at every change and every 15 s), the alignment answers with their times
(`noniusChecks`), the full segment log (`rooms`), all settings including lens calibration, and
`tuningId`.

## Known limitations

- **Contrast is a model, not a measurement** (see above). Display gamma, brightness, OLED
  behaviour at low levels and the viewer are all unaccounted for.
- **No eye tracking and no fixation control.** Nothing verifies that the player is looking, or
  that both eyes are open.
- **No compliance verification** beyond time played and per-eye exposure.
- **Viewer fit.** Cardboard viewers are designed for adult eye spacing (about 63 mm); a young
  child's is nearer 50 mm. The lens-centre control shifts both eyes together and cannot correct a
  mismatch.
- **Crosstalk** between eyes depends on the viewer's divider; it is assumed to be zero.
- **The easy setup threshold** comes from a game with catch trials, not a psychophysical procedure.
- **Uncalibrated timing.** Everything runs on the browser's animation frame; a slow phone runs the
  games slower, and the session clock stops while the app is in the background.

## Licence, source and authorship

Gloamhold is free software under the **GNU Affero General Public License v3.0 or later**
(`LICENSE`). The source is at <https://github.com/saruuuuul/gloamhold>. If you run a modified
version for others over a network, the AGPL requires you to offer them its source.

Large parts of the code were written with generative AI (Claude), directed and reviewed by the
maintainer. If authorship matters for your institution's review, say so when you get in touch.

Fonts (Silkscreen, IBM Plex Sans / Mono) are loaded from Google Fonts under the SIL Open Font
License. The *Carol of the Bells* ostinato is Mykola Leontovych's *Shchedryk* (1916, public
domain); the rest of the music is original. There are no other third-party assets.

To discuss a study, open an issue on the repository.

---
_Prepared with generative AI (Claude). Public document._
