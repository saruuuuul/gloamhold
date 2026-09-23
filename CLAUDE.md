# Gloamhold — working notes for Claude Code

Side-by-side stereo dungeon crawler built for **dichoptic vision training**. Two half-screen
viewports feed one eye each through a Cardboard-style viewer, with independent per-eye
contrast, so the game can be arranged such that neither eye can finish it alone.

**Keep the medical framing honest.** This is a hobby build, not a treatment, and the README
and in-app disclaimer say so. Do not add efficacy claims, do not describe it as therapy, and
do not remove or soften the disclaimer block in `src/10-panels.html` or `README.md`. If a
change would make the tool feel more clinical than it is, say so rather than shipping it.

---

## Commands

```bash
python3 build.py          # src/ + public/ -> dist/   (the only build step)
node tools/check.mjs      # zero-dependency invariant + wiring checks — run after every edit
npm install               # once: dev tooling only (playwright); the app itself has no deps
node tests/smoke.mjs      # headless playthrough — or `npm run verify` for all three
python3 -m http.server 8000 --directory dist   # serve for a phone on the same wifi
```

Push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

On Windows use `python build.py` if `python3` is not on PATH. Nothing else differs; there
are no native dependencies.

`dist/` is generated and gitignored. Never hand-edit it — edit `src/` and rebuild.

## How the build works, and what it forbids

`build.py` concatenates `src/*.html` then `src/*.js` **in filename order** and wraps all the
JavaScript in a single IIFE. There is no bundler, no module system and no dependencies.
Consequences that are easy to violate:

- **No `import` / `export` / `require`.** Files are not modules; they share one scope.
- **Do not open or close a function scope in a source file.** `build.py` supplies the
  `(function(){ "use strict"; ... })();` wrapper. A stray `})();` silently cuts later files
  out of scope — this has happened once already and cost a debugging cycle.
- **Prefer `var` and function declarations** for anything used across files. Declarations
  hoist across the whole concatenated bundle; `let`/`const` at top level do not, so a
  `const` in `70-ui.js` is invisible to `40-entities.js` at load time.
- **Numbering is the dependency graph.** `20-core.js` runs before `40-entities.js`. If a new
  file must run earlier, name it accordingly rather than reordering by hand.
- **No external scripts or stylesheets except Google Fonts.** The same file is published as a
  Claude Artifact, whose CSP blocks everything else. Inline it or do without.

## Invariants that carry the actual purpose

These are not style preferences. Breaking one makes the training claim false while the game
still looks fine, which is the worst kind of bug here.

1. **Alpha *is* contrast.** Every foreground sprite is drawn on top of the floor fill, so
   compositing at alpha *a* gives `L = a·L_obj + (1−a)·L_floor` — its Michelson contrast
   against the floor is scaled by exactly *a*. The "contrast %" in the UI is that *a*.
   Never draw a signal sprite onto bare canvas, never use `globalCompositeOperation`,
   shadows, or gradients on signal layers, and never fake dimness by picking a darker colour.
2. **`alphaFor(eye, layer)` in `20-core.js` is the only place eye visibility is decided.**
   Anything new that gets drawn must pick a layer: `world`, `player`, `foe`, `item`, `hud`.
   Do not branch on `cfg.weakEye` anywhere else.
3. **Terrain and the player go to both eyes at full contrast.** That is the binocular fusion
   lock, along with the corner brackets. Do not make them eye-dependent "for difficulty".
4. **All drawing goes into the offscreen `scene` canvas.** `renderScene()` draws, `present()`
   uploads it as a texture and applies the lens warp. Nothing should draw to the visible
   canvas directly, or it escapes the lens correction.
5. **Lens overfill must stay paired with the shader.** The fragment shader normalises by
   `fm = 1 + k1 + k2`; `lensZoom()` returns `1/fm` and scales the scene to cancel the centre
   magnification. Change one and you must change the other, or the picture silently zooms.
6. **Every new number goes in `TUNING` (`src/30-tuning.js`), not as a literal.** The dev panel
   grows a slider for each numeric leaf automatically. If the auto-picked slider range is
   wrong, add a pattern to `RANGE_RULES` in `src/80-dev.js` rather than hard-coding a control.
7. **Menu chrome is binocular and identical.** Every stereo screen draws the same pixels into
   both viewports at full contrast — that is the fusion lock, same job as the in-game corner
   brackets. `tests/smoke.mjs` compares the two halves with the lens off and fails above 1%
   difference. The two deliberate exceptions are the nonius bars and the child wizard's
   target; both are marked `eye-alpha: intentional` and both *are* the measurement.
8. **A screen you cannot use with the viewer on does not exist.** New player-facing UI goes in
   `SCREENS` (`src/55-menu.js`), not in `10-panels.html`. The HTML panels are a flat fallback
   for a grown-up at a desk and the home of the generated tuning panel; reaching for them for
   anything else means the player has to take the viewer off, which is exactly what invalidates
   an alignment check.
9. **A measurement a masher can pass is not a measurement.** `kidHunt` interleaves
   exactly `TUNING.kid.catchTrials` rounds where nothing is presented. Press on
   `falseAlarmLimit` of them and the run is discarded — `cfg.strong` is left alone and
   `SCREENS.kidRetry` explains why. This started as a per-round *probability*, which let a
   short run arm one blank and wave a button-masher straight through; it is a count now, and
   `tests/smoke.mjs` drives both a masher and an honest player to prove it still separates
   them. Do not soften it back into a rate.
10. **Child mode must never make struggling reduce the training.** `cfg.kidMode` caps
   contrast step-ups at `TUNING.session.stepUpsPerRoom` per room and replaces death with a
   knockdown. Without the cap, a child who gets hit repeatedly has the stronger eye pushed
   back up each time, so the harder he finds it the less dichoptic load he receives — the
   exact opposite of the point.
11. **Anything the child must act on goes through `drawSimpleScreen()`.** One icon, one
   line, one big button — and the button is anchored to the BOTTOM of the safe area and
   drawn last, so no amount of content above it can push it off screen. The old end-of-run
   screen built a seven-row stats table first and laid its buttons out below it; once the
   lens inset took 13% off each edge there was nothing left on screen to put a cursor on,
   which reads to a player as "the controller does not work here". Numbers for grown-ups go
   on `SCREENS.report`, never on a screen a five-year-old lands on.
12. **Sound is synthesised, never loaded.** No `<audio>`, no fetch, no base64 blobs. The
   Artifact CSP blocks external requests and the build is one file. Add an entry to `SFX` in
   `src/35-audio.js` built from `tone()` / `hiss()`, and call it through `sfx('name')`, which
   is a no-op until `audioUnlock()` has run on a real gesture.

## File map

| File | Holds |
|---|---|
| `src/00-head.html` | `<title>`, Google Fonts link, all CSS |
| `src/10-panels.html` | **Flat fallback** panels + the generated tuning panel. Not what you see in the viewer |
| `src/20-core.js` | `cfg`, session `S`, canvas + WebGL lens stage, `alphaFor`, dungeon tables, room building |
| `src/30-tuning.js` | `TUNING` and its defaults, load/save/walk helpers |
| `src/35-audio.js` | Synthesised sound: `audioUnlock`, `tone`/`hiss`, the `SFX` catalogue, `sfx(name)`; plus `SPEECH` / `say(key)` spoken prompts |
| `src/40-entities.js` | Enemy behaviour, collision, damage, the adaptive staircase, doors |
| `src/50-render.js` | Palette, per-eye render, sprites, calibration grid |
| `src/55-menu.js` | Stereo menus: engine, `SCREENS`, icons, the child setup wizard, `PROG` stars/streak, the rotate prompt |
| `src/60-hud.js` | HUD, nonius check, keyboard / gamepad / touch / tilt input, menu input polling |
| `src/70-ui.js` | Flow control (`startRun`/`resumeRun`/`doPause`), flat panel wiring, wake lock, game loop, `uiLoop`, boot |
| `src/80-dev.js` | Auto-generated tuning panel, session telemetry, `window.GH` handle |
| `public/` | manifest, service worker, icons — copied to `dist/` with `__BUILD__` substituted |

## Domain notes

- **Modes.** `rebalance`: both eyes see everything, stronger eye fainter. `split`: enemies and
  shots to the weak eye only, keys/hearts/door locks to the strong eye only. In `split`, the
  strong eye's items are floored at `TUNING.therapy.splitItemFloor` so the dungeon stays
  winnable — if you change that, check the run is still completable.
- **Staircase.** A room cleared without a hit multiplies the stronger eye's contrast by
  `stepDownFactor`; a hit multiplies it by `stepUpFactor`. It is deliberately asymmetric.
- **Nonius check.** Vertical bar to the weak eye, horizontal to the strong, ring to both.
  Answer 3 ("no green bar") means suppression and drops the contrast automatically. It runs
  as a stereo screen (`SCREENS.nonius`) so it can be answered without lifting the viewer —
  lifting it is what makes the answer meaningless. `noniusAnswer()` stores its verdict in
  `noniusMsg` for whichever presentation asked.
- **Session shape.** In child mode a run ends on a planned note: `checkSessionGoal()` in
  the loop warns at `TUNING.session.warnMinutes` and calls `finishSession()` at `minutes`,
  which awards stars and opens `SCREENS.sessionDone`. `PROG` (stars, day streak, sessions,
  best contrast) is the only state that outlives a run; it lives in `gloamhold.progress`.
  The market alternatives this replaces failed on boredom rather than on mechanism, so the
  reward loop is load-bearing, not decoration.
- **Spoken prompts.** The player cannot read. `say(key)` speaks from the `SPEECH` table via
  the browser's own synthesiser — still no assets, no network. If the device has no voice for
  `cfg.speakLang` it stays **silent** rather than reading Cyrillic in an English voice;
  `speechStatus()` surfaces that on the grown-up screen so the failure is visible.
- **Child wizard.** `SCREENS.kidIntro` → `kidHunt` → `kidSticks` → `kidDone`. `kidHunt` is a
  descending staircase: a target is presented to the **stronger eye only** at `HUNT.c`, and
  the faintest catch divided by `huntStepFactor` (times `safetyBackoff`) becomes `cfg.strong`.
  Two misses or `huntRounds` catches ends it. It sets `cfg.kidSet`. It is a detection
  threshold from a game — do not let copy anywhere imply it is a clinical measurement, and do
  not move "which eye is weaker" into it: a child cannot answer that and a wrong answer trains
  the wrong eye.
- **Dungeon.** 3×3 room grid in `ROOMS` (`20-core.js`), keyed `"col,row"`, row 0 at the top.
  Required path: start `1,2` → `0,2` → `0,1` → `0,0` (warden's key) → `1,1` → boss `1,0`.
  The small key in `2,1` unlocks `2,0` for an optional heart vessel. Adding a room means an
  entry in `ROOMS`, matching `doors` letters on both sides, and a `PATTERNS` layout.

## Gotchas already paid for

- `__BUILD__` is substituted by `build.py` in both the bundle and `public/*` text files. The
  stamp shows on the setup and pause screens; ask for it in any bug report.
- The Claude Artifact viewer blocks page-initiated downloads, so the "save log as file"
  button hides itself when `window.claude` exists. Clipboard copy is the path that works
  everywhere.
- The service worker is network-first for the page so a deploy lands on next launch. It only
  registers over https, so `file://` and LAN http testing are unaffected.
- WebGL absence is handled: `initGL()` falls back to a plain 2D blit and the lens controls
  disable themselves. Keep that path working — it is the fallback on old hardware.
- `newGame()` clears session stats *before* entering the first room, so the opening room
  appears in the room log. Do not reorder those lines.
- **Menu navigation is half event-driven and half polled, on purpose.** Keyboard direction
  presses step from the `keydown` event; the poll in `gatherMenuInput()` only supplies
  auto-repeat. Doing it all from the poll loses two taps that land inside one animation
  frame — that bug shipped once and made the menu feel like it was ignoring input.
  Gamepads have no events, so their first step *and* their repeat both come from the poll.
- `show()` calls `closeMenu()` and `openMenu()` calls `hideAll()`. A flat panel and a stereo
  menu must never be live at once, or the UI loop keeps driving the hidden one's cursor.
- **Death poofs and hit sparks draw INSIDE the foe alpha block.** They were outside it,
  at full contrast to both eyes, which told the stronger eye exactly where an enemy it is not
  allowed to see had just died. Anything spawned by a foe belongs to the foe layer.
- **Portrait is refused, not rendered.** `renderScene()` draws `drawRotatePrompt()` and
  returns whenever `VH > VW`. Orientation lock is denied far more often than granted, and two
  tall slivers fuse into nothing. It is deliberately not stereo — there is nothing worth
  fusing until the phone is turned.
- **The smoke test does not need Playwright's own browser.** It tries the bundled Chromium,
  then the installed Chrome, then Edge. Each Playwright release pins a new browser revision,
  so without the fallback a routine `npm update` made the test crash until someone downloaded
  another ~150 MB of Chromium. Its success line names which one ran (`ok [chrome] — …`).
  It still exits 0 with `skip` if nothing is found — say so when reporting, a skip is not a pass.
- Everything time-based hangs off `requestAnimationFrame`, so a backgrounded or unpainted
  page freezes the session clock. That is correct (time should not accrue in a pocket) but it
  makes headless testing of the session timer unreliable unless something forces a paint.
- The menus animate, so there is a permanent `requestAnimationFrame` (`uiLoop`) that idles
  out in one branch while the dungeon loop owns the frame. Do not "optimise" it away — it is
  also the only thing polling the gamepad in menus.

## Working style

Small, verifiable changes. After any edit: `python3 build.py && node tools/check.mjs`.
When behaviour changes, say what a session log would look like if it worked, not just that
it compiles. Push only when asked.
