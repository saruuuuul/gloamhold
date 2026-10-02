# Gloamhold — working notes for Claude Code

Side-by-side stereo games built for **dichoptic vision training**: an island dungeon crawler
plus four arcade games (Gator Truck, Blocks, Space Rocks, Racer) behind one stereo game
picker. Two half-screen viewports feed one eye each through a Cardboard-style viewer, with
independent per-eye contrast, so each game can be arranged such that neither eye can finish
it alone.

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
                          # (no matching Playwright browser? it falls back to CHROMIUM_PATH,
                          #  $PLAYWRIGHT_BROWSERS_PATH/chromium or /usr/bin/chromium)
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
   Anything new that gets drawn must pick a layer: `world`, `player`, `foe`, `item`, `clue`,
   `hud`. Do not branch on `cfg.weakEye` anywhere else. Arcade games draw per-eye content
   through `withLayer(eye, layer, fn)` (`62-arcade.js`), which is `alphaFor` plus the alpha
   reset; `tools/check.mjs` fails a game file that uses neither.
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
   target; both are marked `eye-alpha: intentional` and both *are* the measurement. The game
   picker's pictures of the games are menu chrome too: they show a rock or a rival car at full
   contrast to both eyes, and that is fine, because nothing is being measured on a menu.
8. **A screen you cannot use with the viewer on does not exist.** New player-facing UI goes in
   `SCREENS` (`src/55-menu.js`, or the file that owns it — the picker and the shop are in
   `58-hub.js`), not in `10-panels.html`. The HTML panels are a flat fallback
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
   contrast step-ups at `TUNING.session.stepUpsPerRoom` per SEGMENT and replaces death with a
   knockdown. Without the cap, a child who gets hit repeatedly has the stronger eye pushed
   back up each time, so the harder he finds it the less dichoptic load he receives — the
   exact opposite of the point. A segment is a dungeon room, or an arcade game's level part,
   wave or checkpoint section; `stairSegment()` opens one and `STAIR.ups` counts within it.
   In the arcade games no child-mode failure ends a run either: Blocks sweeps the lower half
   away, a hit ship blinks and carries on, a crashed truck is put back upright, a spun car
   drives on. Only grown-up mode has a game over (`arcGameOver`).
11. **Anything the child must act on goes through `drawSimpleScreen()`.** One icon, one
   line, one big button — and the button is anchored to the BOTTOM of the safe area and
   drawn last, so no amount of content above it can push it off screen. The old end-of-run
   screen built a seven-row stats table first and laid its buttons out below it; once the
   lens inset took 13% off each edge there was nothing left on screen to put a cursor on,
   which reads to a player as "the controller does not work here". Numbers for grown-ups go
   on `SCREENS.report`, never on a screen a five-year-old lands on. The game picker and the
   paint shop are the two choice screens; they keep the rule where it matters — one big
   picture, one big button drawn last at the bottom via `drawBigButton`.
12. **Which layer a thing is drawn on is a design decision, and it is written down.**
   `world` (both eyes, full contrast): terrain, bushes, pots, stones, torches, the player, the
   owl, bombs and arrows. `clue` (`alphaFor(eye,'clue')` — faint in the stronger eye, and
   weak-eye-only in forced fusion): plates, sparkles, cracks, eye switches. `item`: chests,
   coins, keys, anything you GET. The things he wants to find are on the per-eye layers so that
   looking is driven by curiosity, not only by being chased. **Anything an object spawns
   belongs to that object's layer** — death poofs are foe-layer, the "a chest appeared" burst
   is item-layer. Both of those were once drawn at full contrast to both eyes, and each leaked
   exactly the position the other eye was not supposed to have. Glow-bugs in dungeon rooms are
   `clue`. The arcade games write theirs down the same way:

   | Game | `world` / `player` (both, full) | `foe` | `item` | `clue` |
   |---|---|---|---|---|
   | Gator Truck | sky, ground, water, tunnel rock, flags; the truck | junk cars, boulders, pufferfish | coins, stars, pearls | gate signs, ramp arrows, balloons |
   | Blocks | the well, the lines-to-go bar | falling piece, next piece, bomb blast | settled stack, gems, clear sparks | ghost piece |
   | Space Rocks | field, frame; the ship, its shots, its shield | rocks, comets, rock king (+ its health bar), saucer and its shots, debris | power-ups | — |
   | Racer | road, verges, lanes, flags, scenery; his car | rivals, oil, ice (+ rival marks on the progress bar) | coins, nitro | ramps, boost pads |

15. **Rewards never appear where a per-eye thing died.** A coin dropped where a rock broke or
   a foe fell is an item-layer sprite marking exactly where a foe-layer object was — in forced
   fusion, that shows the stronger eye what it is not allowed to see. So coins from foes go
   straight to the counter (`arcCoin`, `addCoins`), Space Rocks' power-ups drift in on their
   own schedule, and the saucer's star is awarded, not dropped. The island warden's light is
   the one old exception, and it only appears once the fight is over.
16. **Comfort in a viewer is not optional.** No camera shake — the eye sees motion the body
   did not make, which is the recipe for motion sickness; impacts use hit-stop (a few frozen
   frames, `arcHitstop`), squash and local particles instead. No full-screen flashes and nothing
   large flickering fast (photosensitivity). The truck's camera cuts to a respawn rather than
   sweeping back across the course.
13. **Clues change shape, never alpha.** A sparkle twinkles by growing its arms and a coin
   glints by narrowing; neither ever modulates `globalAlpha`, because alpha IS the contrast
   and an oscillating alpha would make "contrast %" a peak rather than a value. The owl's hint
   follows the same rule: it turns to look and speaks — it never puts a glow on the clue.
14. **Sound is synthesised, never loaded.** No `<audio>`, no fetch, no base64 blobs. The
   Artifact CSP blocks external requests and the build is one file. Add an entry to `SFX` in
   `src/35-audio.js` built from `tone()` / `hiss()`, and call it through `sfx('name', arg)`,
   which is a no-op until `audioUnlock()` has run on a real gesture. The carol in
   `36-music.js` is built the same way, scheduled a little ahead on the audio clock.

## File map

| File | Holds |
|---|---|
| `src/00-head.html` | `<title>`, Google Fonts link, all CSS |
| `src/10-panels.html` | **Flat fallback** panels + the generated tuning panel. Not what you see in the viewer |
| `src/20-core.js` | `cfg`, session `S`, canvas + WebGL lens stage, `alphaFor` (incl. the `clue` layer), tiles, `HOME_ROOMS` (island 1), pure `roomGrid()`, `newGame(island)`, `enterRoom` |
| `src/25-islands.js` | `ISLAND_DEFS`, seeded generator `genIsland(n)`, `islandProblems()` validator, unlock costs, `loadIsland` |
| `src/30-tuning.js` | `TUNING` and its defaults, load/save/walk helpers |
| `src/35-audio.js` | Synthesised sound: `audioUnlock`, `tone`/`hiss`, the `SFX` catalogue, `sfx(name, arg)`; plus `SPEECH` / `say(key)` spoken prompts with the Mongolian → English fallback (`speechPick`) and `speechPrime` |
| `src/36-music.js` | *Carol of the Bells* for intense moments: `musicTick(intensity)`, the lookahead scheduler, `MUS` |
| `src/40-entities.js` | `update()` (the orchestrator), enemies (incl. hopper, slime), the spin attack, collision, damage, the staircase (`STAIR`, `stairSegment`), the wardens' patterns (`bossTick`), the item-held-up moment, sealed doors, `dungeonIntense()` |
| `src/42-world.js` | Bushes, pots, stones and plates, torches, sparkles, chests, cracks, eye switches, glow-bugs; their drawing |
| `src/44-tools.js` | Shield, bombs, bow; tool input; their drawing |
| `src/46-owl.js` | The companion: follows, speaks, hints when stuck |
| `src/50-render.js` | Palette, per-eye render, sprites, calibration grid |
| `src/55-menu.js` | Stereo menus: engine, `SCREENS`, icons, the child setup wizard, `PROG` (stars, coins, tools, lights, secrets), the rotate prompt |
| `src/57-map.js` | The sea: island select, the boat, sailing (`MAP.autoTo` sails straight on after a light) |
| `src/58-hub.js` | The game picker (`SCREENS.title`, `GAMES` registry, hold-B for grown-ups), `SCREENS.tapStart`, the paint shop (`PAINTS`, `paintOf`, `SCREENS.shop`) |
| `src/60-hud.js` | HUD, nonius check, keyboard / gamepad / touch / tilt input (`input.act` held, `input.ax/ay` right stick), menu input polling |
| `src/62-arcade.js` | The arcade runtime: `ARC`, `arcadeStart`/`arcadeFrame`/`arcadeEnd`, segments (`arcSegStart`/`Fail`/`End`), `arcCoin`/`arcStar`, `arcLevelDone`, `withLayer`, particles, the arcade HUD, `SCREENS.arcadeDone` |
| `src/63-truck.js` … `66-race.js` | Gator Truck, Blocks, Space Rocks, Racer — each registers itself in `GAMES` |
| `src/70-ui.js` | Flow control (`startRun`/`resumeRun`/`playOn`/`menuStart`/`doPause`, `LIVE`), the sitting clock `SIT`, exposure telemetry, flat panel wiring, game loop (dispatches to `arcadeFrame`), `uiLoop`, boot |
| `src/80-dev.js` | Auto-generated tuning panel, session telemetry (incl. `activity`), `window.GH` handle (incl. `step`/`freeze`/`tp`/`room`/`islandCheck`, and `arcade`/`astep`/`busy`/`arcadeEnd` for the arcade games) |
| `public/` | manifest, service worker, icons — copied to `dist/` with `__BUILD__` substituted |

## Domain notes

- **The game picker.** `SCREENS.title` is a carousel of `GAMES` in `GAME_ORDER`: one big
  moving picture, the name spoken on change, progress shown as pictures (level flag, stars),
  one big button. A child's quick B does nothing there; holding B for
  `TUNING.menu.grownupHoldFrames` opens `SCREENS.adult`, which now holds everything that used
  to be on the old list title (easy setup, sound, music, voice test, stars, flat menus, the
  safety screen). Start in any menu goes through `menuStart()`: a screen's own `start`, else
  `playOn()` — resume the run behind the menu, or back to the picker.
- **The arcade runtime.** `arcadeStart(id)` resets the run with `resetRunStats(id)` (the same
  reset the islands use) and the loop hands frames to `arcadeFrame`. A run is one LEVEL;
  `arcLevelDone(stars)` records 1–3 stars in `PROG.games[id]`, and the next run starts at the
  next level. Levels introduce one new thing every level or two (Blocks: faster; Space Rocks:
  saucer at 2, comets at 3, the rock king every fourth; Racer: ramps and oil from 2, nitro from
  3, ice on snow tracks; Gator Truck: ramps at 2, boulders at 3, tunnels at 4, lakes at 5, the
  moon's low gravity at 6).
- **Tap to start.** Chrome does not treat gamepad presses as user activation, so a
  gamepad-only launch can never start audio, speech or fullscreen. A fresh launch
  (`navigator.userActivation.hasBeenActive === false`) opens `SCREENS.tapStart`; one tap there
  unlocks all three. The picker's footer says so while audio is still not running.
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
  the browser's own synthesiser — still no assets, no network. Phones rarely ship a Mongolian
  voice, so when there is none for `cfg.speakLang` the **English line** is spoken by an English
  voice (`speechPick`); Cyrillic is never handed to an English voice, which is noise a child
  cannot act on. `speechStatus()` says which is happening, and the grown-up screen has *Test
  the voice*. Only with no usable voice at all does it stay silent.
- **Music.** Every activity reports `intense()` 0..1 (the dungeon's `dungeonIntense()`: a
  warden fight is 1, a sealed room 0.7, low hearts 0.8). Above `music.startAt` the carol comes
  in, holds `music.holdSec`, and plays faster and fuller as intensity rises. Menus stop it.
  The ostinato is Leontovych's *Shchedryk* (1916, public domain); the rest is our own.
- **Child wizard.** `SCREENS.kidIntro` → `kidHunt` → `kidSticks` → `kidDone`. `kidHunt` is a
  descending staircase: a target is presented to the **stronger eye only** at `HUNT.c`, and
  the faintest catch divided by `huntStepFactor` (times `safetyBackoff`) becomes `cfg.strong`.
  Two misses or `huntRounds` catches ends it. It sets `cfg.kidSet`. It is a detection
  threshold from a game — do not let copy anywhere imply it is a clinical measurement, and do
  not move "which eye is weaker" into it: a child cannot answer that and a wrong answer trains
  the wrong eye.
- **Island 1.** 3×3 grid in `HOME_ROOMS` (`20-core.js`), keyed `"col,row"`, row 0 at the top.
  Shortest path: start `1,2` → `1,1` → `0,1` → `0,0` (warden's key) → back → boss `1,0` — the
  Cistern is NOT required. The small key in `2,1` opens the Cache, whose stone puzzle holds a
  heart vessel. Secrets: a sparkle in the Threshold, a bomb alcove in the Rookery, an eye switch
  in the Cistern. Nine of its enemies used to spawn inside pattern walls; `islandProblems()`
  now rejects any spawn on a solid tile, on every island, so that cannot return.
- **The sea.** Eight islands (`ISLAND_DEFS`), told apart by colour because he cannot read.
  2–8 are generated from a FIXED seed (`n*7919 + attempt*104729`) — the same island every time,
  so a cracked wall he walked past is still there when he comes back with bombs. Island 2 holds
  the shield, 3 the bombs, 5 the bow, in the key room's puzzle chest. An island opens when the
  one before it is finished, or by total stars (`islandCost`) — stars from every game count.
  The warden drops the island's light; picking it up finishes the island, lights its beacon,
  and **NEXT ISLAND** sails straight on (`MAP.autoTo`). Each warden fights its own way
  (`BOSS_PATTERNS`: charge, ring of shots, summon, leap; alternating two from island 5), with a
  gold-eyed windup as the tell. Extra foes (hoppers from 2, slimes from 4) are added by
  `densifyIsland()` from their OWN seed, after the layout is fixed — feeding them through the
  layout's stream would have moved every wall and secret on islands he has already explored.
  `islandProblems()` is the gate: matching doors, no spawn in a wall, clear push lanes, and the
  warden reachable once the keys you can reach are used.
- **The paint shop.** Coins buy colours for the hero, truck, ship and car (`PAINTS`,
  `paintOf(thing)`). Only player-layer sprites are recoloured, so no contrast the staircase
  measures can change. Spending comes out of `PROG.wallet`; `PROG.coins` stays the lifetime
  count for the grown-up stats (coins from before the shop seed the wallet once).
- **The sitting.** `SIT` in `70-ui.js` spans every run until the sitting ends. When time is up
  it waits for a natural break — a room cleared, a door walked through, an island done, an
  arcade segment ended — or `session.graceMinutes`, whichever first, and never ends mid-fight.
  It used to be the run's own clock, zeroed by `newGame()`, so the planned ending almost never
  fired. `session.minutes` now defaults to 0 (no limit: the planned ending kept dropping him
  back on a menu); the grown-up screen sets a length, and `TUNING_REV` drops the old stored 12.
- **Exposure telemetry.** The session log's `exposure` block says how many seconds each per-eye
  layer had something on it. It is not an outcome measure — only whether the game is giving the
  weaker eye anything to do. Read it that way, and never present it as more.

## Gotchas already paid for

- **"Flat menus" used to be a trap.** It persisted `cfg.flat`, every launch then opened the
  big HTML page, and nothing on that page led back. Now boot always clears `cfg.flat`, both
  flat pages have *Back to the viewer menus* (`btnStereo`, `btnStereo2`), and the entry point
  lives on the grown-up screen, not the child's.
- **Hit-stop eats steps.** `arcHitstop()` freezes a game for a few frames after an impact, so
  a test that forces a second hit on the next `GH.astep(1)` sees nothing happen. Clear
  `GH.arc.hit` between forced impacts.
- **Gator Truck: one control, one job.** The stick used to be the gas on the ground AND the
  lean in the air, so a child holding the gas tipped the nose down on every hop, crest and
  crushed car and crashed on landing — levels 3–5 could not be finished that way. The stick is
  now only the gas; the truck levels itself in the air and holding A flips it. The truck rests
  on its two wheels (`tkRest`), a ramp's lip is found at the FRONT wheel (the ground under it
  falls away much faster than it has been), and landing is a wheel touching down — judging
  either from the middle of the truck made it drive off lips nose-first or land back on the
  ramp a frame after leaving it. `tests/smoke.mjs` holds the gas through every course and
  fails on any crash.
- **A finished dungeon's `G` lingers.** Paths that end a dungeon run on a press (`G.dead ||
  G.won`) must also check `!ARC.id`, or a key press in an arcade game ends it.
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
- `roomGrid(spec, state)` is pure. The generator validates candidate rooms through it, so never
  give it a dependency on `G` or on live state.
- **Stones never enter the outer ring** (`blockCanEnter`): every doorway is there, and a stone in
  a doorway is a room you cannot leave. With that rule an empty-pattern room can never jam a
  stone — the player can always reach its far side. A stone that solved its puzzle is locked to
  its plate.
- **Arrows hit the tile AHEAD of their centre.** Collision is on the leading edge; looking the
  tile up from the centre reported the tile in front of the eye switch, and no bow secret could
  open. `worldArrowHit` is called with the offset tile for that reason.
- **Tests drive the simulation with `GH.freeze()` then `GH.step(n)`** (`GH.astep(n)` for the
  arcade games). If the live loop keeps running, `gatherInput()` overwrites whatever the test
  put into `input` every frame.
- **Headless pages can run well under 60 fps**, and the sail is frame-counted. Poll for the
  outcome; never wait a fixed number of milliseconds for a frame-counted thing. The smoke
  page (2x pixel ratio, software WebGL) can drop to a few frames a second: the held-B check and
  the exposure check both poll, and each frame counts at most 120 ms of exposure.
- **Source files contain literal `·`, `→`, `★`, `‹ ›`.** A patch that matches on the `\u00b7`
  escape instead of the character silently fails to apply — match the character.
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
