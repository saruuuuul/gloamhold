# Gloamhold

A side-by-side stereo dungeon crawler built for **dichoptic vision training** — the two
halves of the screen feed one eye each through a Cardboard-style viewer, and the game is
arranged so that neither eye can finish it alone.

> **Not a medical device.** This is a hobby build, not a treatment. Dichoptic training for
> amblyopia is an active research area with mixed results and belongs under the supervision
> of an optometrist or ophthalmologist who has measured your acuity, stereoacuity and
> suppression. Stop if you get headache, nausea, eye strain, or double vision that persists
> after taking the viewer off. Children should only do this on a clinician's instruction,
> since the alternative treatments they might be skipping have real evidence behind them.

---

## Why the architecture looks like this

The bottleneck in improving this thing is not compile time. It is that **your face is inside
a viewer when you discover the problem**. So the design optimises for three things, in order:

1. **Change parameters without a rebuild.** Every number the engine runs on lives in one
   `TUNING` object. A dev panel generates a slider for each one automatically. Most
   "make the bats less annoying" changes are a slider you move mid-session, not a code edit.
2. **Come back with data, not impressions.** Each run records a session log — contrast
   trajectory, per-room outcomes, hits, alignment-check answers, and the exact tuning in
   force. Copy it out and the next round of changes is grounded.
3. **Ship one file.** No framework, no bundler runtime, no dependencies. `dist/index.html`
   is the entire app. It loads instantly, works offline, and cannot break from a dependency
   update three months from now.

## Layout

```
src/                 concatenated in filename order — 20 runs before 40
  00-head.html       title, fonts, CSS
  10-panels.html     overlay screens (setup, alignment check, pause, tuning)
  20-core.js         config, canvas, WebGL lens stage, dungeon tables
  30-tuning.js       TUNING: every balance / therapy / optics number
  40-entities.js     enemies, physics, damage, the adaptive staircase
  50-render.js       per-eye rendering, contrast layers, calibration grid
  60-hud.js          HUD, nonius check, input (keyboard / gamepad / touch / tilt)
  70-ui.js           panels, sliders, wake lock, game loop, boot
  80-dev.js          auto-generated tuning panel, session telemetry, GH console handle
public/              manifest, service worker, icons — copied to dist verbatim
build.py             concatenate → dist/index.html + dist/artifact-body.html
```

`build.py` substitutes `__BUILD__` with `VERSION + git sha + timestamp`, which is shown in
the corner of the setup and pause screens. When something breaks, that string says which
build it broke in.

## Build

```bash
python3 build.py        # → dist/index.html
```

No dependencies beyond Python 3. To serve locally for a phone on the same wifi:

```bash
python3 -m http.server 8000 --directory dist
# then open http://<your-laptop-ip>:8000 on the phone
```

Note that a service worker needs `https` or `localhost`, so over LAN http you get the game
but not the installable shell. That is fine for iterating; install from the deployed URL.

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.

First-time setup, once:

1. Create an empty repo on GitHub (private is fine — Pages works on private repos on paid
   plans; use public if you are on the free tier).
2. `git remote add origin git@github.com:<you>/gloamhold.git && git push -u origin main`
3. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The first push deploys to `https://<you>.github.io/gloamhold/`.

## On the phone

Open the deployed URL in Chrome, then **⋮ → Add to Home screen**. The manifest requests
`display: fullscreen` and `orientation: landscape`, so launching from the icon gives a real
fullscreen landscape surface with no browser chrome — which a browser tab cannot do.

The game requests a **screen wake lock** while playing, so the display will not sleep
mid-dungeon.

Controls, in order of comfort inside a viewer:

- **Bluetooth gamepad** — stick or d-pad to move, any face button to swing, Start to pause.
- **Head tilt** — enable on the setup screen; tilt to steer, any button to swing.
- **Touch** — left half of the screen steers, right half swings. Only usable in the hand.
- **Keyboard** — WASD / arrows, space to swing, Esc to pause. For desk testing.

## The iteration loop

**In the headset, no code:** pause → *Tuning panel* → move sliders. They persist to
`localStorage` and survive a redeploy. *Respawn this room* re-rolls enemies with the new
sizes and hit points. Copy the JSON profile out when a set of values feels right.

**From a laptop, no rebuild:** plug the Pixel in, open `chrome://inspect`, and the whole
engine is on `window.GH`:

```js
GH.TUNING.bat.speed          // read anything
GH.set('boss.hp', 24)        // write and persist
GH.record()                  // the session log as an object
GH.cfg.strong = 0.25         // force a contrast for one test
GH.redraw()
```

**Anything structural** — new enemy behaviour, new rooms, new mechanics — is a source edit
and a push. Add a number to `TUNING` and the dev panel grows a slider for it on the next
load; there is no panel code to keep in sync. If the auto-chosen slider range is wrong for
a new field, add a pattern to `RANGE_RULES` in `80-dev.js`.

## The dichoptic bits, briefly

- Everything is drawn on top of the floor fill, so compositing a sprite at alpha *a* scales
  its Michelson contrast against the floor by exactly *a*. The "contrast %" in the UI is
  that *a*, not a guess.
- Walls, floor and the player go to **both** eyes at full contrast — that is the fusion
  lock, along with the corner brackets in each view.
- **Contrast rebalance** mode: both eyes see everything, stronger eye fainter.
  **Forced fusion** mode: enemies and shots render to the weak eye only, keys/hearts/door
  locks to the strong eye only. Suppress one eye and half the game disappears.
- **Adaptive staircase**: a clean room pushes the stronger eye's contrast down by
  `therapy.stepDownFactor`; a hit pushes it back up by `therapy.stepUpFactor`.
- **Nonius check**: vertical bar to the weak eye, horizontal to the strong, ring to both.
  A missing bar is suppression, and the answer adjusts the contrast automatically.
- **Lens correction**: the scene renders to a 2D canvas, becomes a texture, and a WebGL
  shader applies the inverse radial warp per eye (`r' = r(1 + k₁r² + k₂r⁴)`) plus optional
  per-channel correction for edge colour fringing. The centre magnification this creates is
  cancelled by rendering the scene at `1/(1+k₁+k₂)` — standard overfill — and the
  surrounding rock is drawn into the margin so the corners are not black.

Built with generative AI (Claude). Personal / internal use.
