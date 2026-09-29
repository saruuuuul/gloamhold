# Gloamhold

A small collection of side-by-side stereo games built for **dichoptic vision training** — an
island dungeon crawler, a transforming monster truck, falling blocks, a space-rock shooter and
a top-down racer. The two halves of the screen feed one eye each through a Cardboard-style
viewer, and each game is arranged so that neither eye can finish it alone.

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
  25-islands.js      the sea: island definitions, seeded generator, validator
  30-tuning.js       TUNING: every balance / therapy / audio / optics number
  35-audio.js        synthesised sound effects and spoken prompts — no assets, no fetches
  36-music.js        Carol of the Bells, synthesised, for the intense moments
  40-entities.js     update loop, enemies, wardens, damage, the adaptive staircase
  42-world.js        grass, pots, stones, torches, sparkles, chests, cracks, eye switches, glow-bugs
  44-tools.js        shield, bombs, bow
  46-owl.js          the companion
  50-render.js       per-eye rendering, contrast layers, calibration grid
  55-menu.js         the stereo menus and the child setup wizard
  57-map.js          the sea map and the boat
  58-hub.js          the game picker, the tap-to-start screen, the paint shop
  60-hud.js          HUD, nonius check, input (keyboard / gamepad / touch / tilt)
  62-arcade.js       what the arcade games share: segments, staircase, rewards, HUD
  63-truck.js        Gator Truck
  64-blocks.js       Blocks
  65-rocks.js        Space Rocks
  66-race.js         Racer
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

## One stereo game picker, and a controller drives it

The app opens on a **game picker**: one big moving picture of a game, its name spoken aloud,
and one big button. Left and right choose; A plays. The picker is where every game ends up
again — finishing a level, leaving from the pause screen, the end of a sitting — so there is
never a reason to take the viewer off to start the next game.

Grown-ups **hold B** on the picker for about a second and a half to reach the grown-up screen
(a child's quick press on B does nothing there). Everything that used to be on the old title
list lives on that screen: the easy setup, sound, music, the voice test, stars, flat menus and
the *not a medical device* page.

Every screen — picker, setup, alignment check, pause, results, lens calibration — is drawn into
the same offscreen canvas as the games, once per eye, so it goes through the same barrel
pre-distortion. A menu you cannot read with the viewer on is a menu you take the viewer off to
use, and taking the viewer off is what ruins an alignment check. The HTML panels still exist as
a flat fallback for a grown-up at a desk, and they are where the generated tuning panel lives;
you reach them from **Flat menus (no viewer)** on the grown-up screen. They have a *Back to the
viewer menus* button, and the app always starts in the viewer menus — choosing flat menus once
used to strand every later launch on the big flat page.

**Tap once on launch.** Chrome will not start sound, speech or fullscreen from a gamepad —
only from a real tap or key. A fresh launch shows one big TAP screen before the viewer goes
on; that tap unlocks all three. The picker reminds you if it was skipped.

Controls, everywhere:

| | |
|---|---|
| d-pad / stick / arrows / WASD | move the cursor, change a value |
| A (or any face button) / Enter / Space | pick |
| B / Esc / Backspace | back |
| Start / P | play, or resume from the pause screen |
| hold B / hold Esc | on the game picker: the grown-up screen |
| LB / RB | nudge the focused value |
| tap | on a one-button screen, anywhere is the button; on a list, tap top / middle / bottom |

## Setting it up with a child

**Easy setup (butterfly)** on the grown-up screen runs a three-step wizard with no reading in it: put the goggles
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

A session can have a **planned ending**: set a length on the grown-up screen and it warns a
couple of minutes out, then finishes at the next natural break on a treasure screen with stars.
By default there is no limit — the planned ending kept dropping play back on a menu, which
broke the flow more than it helped. Stars, coins, colours, levels and a day streak persist
between sessions. That is deliberate — the games this was built to replace lost on boredom,
not on mechanism.

Child mode applies to every game: no failure ever ends a child's run, and a bad stretch can
only cost one step of contrast per segment (a room, a level part, a wave, a checkpoint).

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

## The games

Every game draws what matters on the per-eye layers, faint in the stronger eye (and, in forced
fusion, split between the eyes); the ground, the frame and whatever he steers go to both eyes
at full contrast so there is always something to fuse on. Each game is a run of **levels**: a
level ends on one big NEXT button and 1–3 stars, and the next run starts at the next level. Each
level or two brings one new thing.

**Gator Truck** — a side-view monster truck with a gator at the wheel, in the spirit of
*Rallygator*'s transforming truck (our own art and courses). The stick drives, **A** hops,
**B** transforms at a gate: the *truck* crushes junk cars for coins and hops boulders, the
*mini* fits through tunnels, the *sub* dives through lakes. Every gate has a sign showing the
form it needs, and finding that sign is a looking job for the weaker eye; if it is missed, the
gator says so, and in child mode it changes by itself after the hint. Big jumps and flips pay
stars. Courses rotate meadow, desert, snow, forest, lake and the moon's low gravity.

**Blocks** — falling blocks. ‹ › move, up or A rotates, down drops faster, B drops at once.
Gems ride in some pieces and pay a star when their row clears; an occasional bomb blasts a hole;
clears in a row climb in pitch; four at once is a BIG CLEAR. In child mode reaching the top
sweeps the lower half away instead of ending the game.

**Space Rocks** — a little ship among rocks in a field that wraps round. The stick flies the
ship where it points (no rotate-and-thrust), A held fires, a right stick aims if the pad has
one, B raises a shield bubble. Rocks split as they break; a saucer worth a star crosses from
level 2, comets arrive at 3, and the rock king comes every fourth level. Power-ups drift through.

**Racer** — a top-down race up a winding road, starting at the back of the grid. The stick
steers, A is the gas (automatic in child mode), B brakes. Every rival passed pays a coin; ramps
jump clean over traffic, boost pads and nitro cans are bursts of speed, oil spins you, and one
rival likes to bump. The finish places you, and the podium is the trophy.

**Paint Shop** — coins from every game buy colours for the hero, the truck, the ship and the
car. Only the things he steers are recoloured, so nothing the staircase measures can change.

**Carol of the Bells** plays in the intense moments — a warden fight, a stack near the top, a
rock about to hit, the last stretch of a race — faster and fuller the more intense it gets,
synthesised from oscillators like every other sound. The melody is Leontovych's *Shchedryk*
(1916, public domain); the bass and bells are our own. It can be turned off on the grown-up
screen.

## Islands, and what there is to do on them

This grew into an Oceanhorn-style adventure because that is the game he loves, and the market
dichoptic games lost him to boredom — compliance is what this whole thing lives or dies on.

**The sea** is the hub: eight islands told apart by colour, a little boat that sails between
them, and a beacon on every island whose light he has brought back. Islands open as he earns
stars. Island 1 is the hand-built Gloamhold; the rest are generated from fixed seeds, so each
island is the same every visit.

**On an island** he cuts grass and smashes pots for coins and hearts, pushes stones onto plates,
lights torches with his sword, digs where it sparkles, and opens chests — holding the find up
over his head while the world pauses, which is the reward. Some rooms shut their doors until
the monsters are beaten. The key room's puzzle hides either the warden's key or a **tool**:
the shield on island 2, bombs on 3, the bow on 5. Bombs open cracked walls and the bow hits eye
switches, so earlier islands keep secrets he can only reach later. The warden drops the
island's light; picking it up finishes the island, opens the next one and **sails straight
there** — the islands are levels, not a single dungeon that ends.

Every island's warden fights its own way — charging, firing a ring of shots, calling helpers,
leaping with a shockwave — and its eyes turn gold just before it acts, a tell he can learn.
Holding the action button charges a **spin attack**; letting go swings the sword all the way
round. Frogs leap at him from island 2 and slimes that split in two appear from island 4.
**Glow-bugs** drift through ordinary rooms on the clue layer, a coin each for catching them.

**The owl** follows him, says the prompts out loud in Mongolian, and helps when he has been
stuck for a while — by turning to look and speaking, never by putting a glow on the answer.

**Why the layers matter here.** Everything he wants to find — plates, sparkles, cracks, eye
switches, chests, coins — is drawn on the per-eye layers, faint in the stronger eye. So looking
for treasure is the part that makes the weaker eye work, driven by curiosity rather than only
by being chased. That is a design choice, not a claim about outcomes.

Controls stay at two: **A** acts (swing, open, dig), **B** uses the tool in hand, a shoulder
button swaps tools.

## Sound

Every effect is synthesised from oscillators at runtime. There are no audio files, nothing is
fetched, and the single-file build stays single-file — which also means it works inside the
Artifact sandbox, where external requests are blocked. The context is only created on a real
gesture, because browsers refuse otherwise. `TUNING.audio` has a master gain and separate
`game`, `ui` and `music` sub-mixes; **Sound** on the grown-up screen mutes everything.

The games also **speak**, through the browser's own speech synthesiser, for the same reason —
no files, no network. Language is set on the grown-up screen. Phones rarely ship a Mongolian
voice; without one, the English line is spoken by an English voice (never Cyrillic read by an
English voice, which is noise a child cannot act on). **Test the voice** on the grown-up
screen speaks a line and says which voice is in use, so check it on the actual phone. Speech,
like sound, only starts after the first tap.

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

**In the headset, no code:** pause → *Grown-up setup* → *Advanced tuning* → move sliders. They persist to
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
