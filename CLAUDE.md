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
node tests/smoke.mjs      # optional headless playthrough; needs `npm i -D playwright`
python3 -m http.server 8000 --directory dist   # serve for a phone on the same wifi
```

Push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

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

## File map

| File | Holds |
|---|---|
| `src/00-head.html` | `<title>`, Google Fonts link, all CSS |
| `src/10-panels.html` | Overlay screens: setup, alignment check, pause, tuning, lens bar |
| `src/20-core.js` | `cfg`, session `S`, canvas + WebGL lens stage, `alphaFor`, dungeon tables, room building |
| `src/30-tuning.js` | `TUNING` and its defaults, load/save/walk helpers |
| `src/40-entities.js` | Enemy behaviour, collision, damage, the adaptive staircase, doors |
| `src/50-render.js` | Palette, per-eye render, sprites, calibration grid |
| `src/60-hud.js` | HUD, nonius check, keyboard / gamepad / touch / tilt input |
| `src/70-ui.js` | Panel wiring, sliders, wake lock, immersive mode, game loop, boot |
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
  Answer 3 ("no green bar") means suppression and drops the contrast automatically.
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

## Working style

Small, verifiable changes. After any edit: `python3 build.py && node tools/check.mjs`.
When behaviour changes, say what a session log would look like if it worked, not just that
it compiles. Push only when asked.
