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
  10-panels.html     flat fallback panels + the generated tuning panel
  20-core.js         config, canvas, WebGL lens stage, dungeon tables
  30-tuning.js       TUNING: every balance / therapy / audio / optics number
  35-audio.js        synthesised sound effects — no asset files, no fetches
  40-entities.js     enemies, physics, damage, the adaptive staircase
  50-render.js       per-eye rendering, contrast layers, calibration grid
  55-menu.js         the stereo menus and the child setup wizard
  60-hud.js          HUD, nonius check, input (keyboard / gamepad / touch / tilt)
  70-ui.js           flow control, wake lock, game loop, boot
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

## Menus are stereo, and a controller drives them

Every screen the player sees — title, setup, alignment check, pause, summary, lens
calibration — is drawn into the same offscreen canvas as the dungeon, once per eye, so it
goes through the same barrel pre-distortion. A menu you cannot read with the viewer on is a
menu you take the viewer off to use, and taking the viewer off is what ruins an alignment
check. The HTML panels still exist as a flat fallback for a grown-up at a desk, and they are
where the generated tuning panel lives; you reach them from **Flat menus** on the title.

Controls, everywhere:

| | |
|---|---|
| d-pad / stick / arrows / WASD | move the cursor, change a value |
| A (or any face button) / Enter / Space | pick |
| B / Esc / Backspace | back |
| Start / P | play, or resume from the pause screen |
| LB / RB | nudge the focused value |
| tap | on a one-button screen, anywhere is the button; on a list, tap top / middle / bottom |

## Setting it up with a child

**Easy setup** on the title runs a three-step wizard with no reading in it: put the goggles
on, catch the butterfly, say how many sticks you see.

The butterfly step is a descending staircase. A target is shown to the **stronger eye only**,
fainter each round, and the faintest one the player still catches — backed off one step —
becomes the starting contrast. That is a detection threshold produced by a game, not a
clinical measurement: a tired or distracted child reads lower than they really are. The
grown-up screen shows what it measured and lets you override it.

One decision the wizard deliberately does **not** ask: which eye is the weaker one. A
five-year-old cannot answer it, and a wrong answer trains the wrong eye. It comes from the
grown-up screen, from whoever measured it.

Also worth knowing before you put a small child in a viewer: Cardboard-style optics are
built for an adult eye spacing, around 63 mm. A five-year-old is nearer 50 mm. If the lens
centres do not sit over the pupils, the barrel correction is off-axis for both eyes, which
adds strain and works against the fusion the whole exercise depends on. The **lens centre**
control shifts both eyes together and cannot fix a mismatch — check the viewer physically.

## Playing it with a child

**Child mode** (on by default, grown-up screen to turn it off) changes the shape of the game
rather than just the numbers: more hearts, slower and softer enemies, and **you cannot die** —
you get knocked down and helped back up. It also caps how much contrast a bad room can cost,
because otherwise a child who is struggling gets the stronger eye pushed back up on every hit,
and the harder he finds it the less dichoptic load he actually receives.

A session has a **planned ending**: it warns a couple of minutes out and then finishes on a
treasure screen with stars, rather than running until a five-year-old has had enough. Stars
and a day streak persist between sessions and are the only thing in this app that outlives a
run. That is deliberate — the games this was built to replace lost on boredom, not on
mechanism.

The **butterfly wizard interleaves catch trials**: rounds where nothing is shown at all. Press
the button on enough of those and the run is thrown away and the contrast left untouched,
because a child who mashes the button would otherwise always "measure" whatever the last
scheduled round happened to be. The screen asks for one more go; the line underneath tells the
grown-up what actually happened.

Dying is not a dead end: the run ends on **GOOD TRY!**, stars are awarded anyway, and one big
button starts the next one. A child who gets nothing for a bad run stops having bad runs by
not playing. The numbers a grown-up wants moved to **This run in numbers** on the grown-up
menu, because they were crowding the buttons off the bottom of the screen behind the lens
inset — which is what made the end of a run feel like the controller had stopped working.

Held upright, the app shows **turn the phone** instead of rendering. Orientation lock is
refused more often than it is granted, and two tall slivers do not fuse into anything.

## Sound

Every effect is synthesised from oscillators at runtime. There are no audio files, nothing is
fetched, and the single-file build stays single-file — which also means it works inside the
Artifact sandbox, where external requests are blocked. The context is only created on a real
gesture, because browsers refuse otherwise. `TUNING.audio` has a master gain and separate
`game` and `ui` sub-mixes; **Sound** on the title mutes everything.

The wizard also **speaks its instructions**, through the browser's own speech synthesiser, for
the same reason — no files, no network. Language is set on the grown-up screen. If the device
has no voice installed for that language the app stays silent rather than reading Cyrillic
aloud in an English voice, which is noise a child cannot act on; **Speech on this device**
reports which it is, so check it on the actual phone before relying on it.

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
