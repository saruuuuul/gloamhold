#!/usr/bin/env node
/* Headless playthrough. Run `npm install` once; no browser download needed if
   Chrome or Edge is installed (see launch() below).
   Checks the things a static check cannot: that the page boots without errors,
   that both eye viewports actually differ in contrast, that a menu is drawn
   identically to both eyes, that the child wizard lands on a sane contrast,
   that the dev panel builds, and that a session log comes out with a room in it.
   And for the game picker: that a fresh launch asks for the one tap Chrome
   needs, that the flat panels can no longer strand a launch, that every
   arcade game draws per-eye, steps the staircase per segment, never ends a
   child's run on failure, and that the islands carry on to the next one.

   The menus are canvas, not DOM, so there is nothing to click by selector —
   this drives them through the same GH handle you would use from a console. */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const page_url = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;
if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.error('dist/index.html missing — run `python3 build.py` first');
  process.exit(1);
}

let chromium;
async function loadPlaywright() {
  try { return (await import('playwright')).chromium; } catch {}
  // fall back to a global install, which is how some machines have it
  try {
    const { execSync } = await import('node:child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const m = await import(pathToFileURL(join(root, 'playwright', 'index.js')).href);
    return m.chromium || (m.default && m.default.chromium) || null;
  } catch {}
  return null;
}
chromium = await loadPlaywright();
if (!chromium) {
  console.log('skip — playwright not installed (npm i -D playwright)');
  process.exit(0);
}

/* Bundled browser first, then whatever Chromium the machine already has.
   Every Playwright release pins a new browser revision, and without this a
   routine `npm update` turned the smoke test into an uncaught crash until
   someone downloaded another ~150 MB build of Chromium to run one file. */
async function launch() {
  /* autoplay: lets the AudioContext run headless, so the carol can be checked */
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
  const tried = [];
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      return { browser: await chromium.launch({ args, ...(channel ? { channel } : {}) }), via: channel || 'bundled chromium' };
    } catch (e) {
      tried.push(`${channel || 'bundled'}: ${String(e.message).split('\n')[0]}`);
    }
  }
  /* then any Chromium binary already on the machine: an explicit CHROMIUM_PATH,
     a browsers directory from an older Playwright, or the distro package */
  const paths = [process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'),
    '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter((p) => p && existsSync(p));
  for (const executablePath of paths) {
    try {
      return { browser: await chromium.launch({ args, executablePath }), via: executablePath };
    } catch (e) {
      tried.push(`${executablePath}: ${String(e.message).split('\n')[0]}`);
    }
  }
  console.log('skip — no usable Chromium found:\n  ' + tried.join('\n  ') + '\n  fix with: npx playwright install chromium');
  process.exit(0);
}

const fails = [];
const { browser, via } = await launch();
/* ignoreHTTPSErrors: behind an intercepting proxy the Google Fonts request fails
   certificate checks and logs a console error that has nothing to do with the app */
const pg = await browser.newPage({ viewport: { width: 900, height: 440 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
pg.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
pg.on('console', (m) => {
  if (m.type() !== 'error') return;
  /* the only remote resource is Google Fonts; offline or behind a proxy it fails
     to load, and the app falls back to system fonts — not an app error */
  const url = (m.location() && m.location().url) || '';
  if (/^Failed to load resource/.test(m.text()) && /^https?:/.test(url)) return;
  fails.push('console: ' + m.text());
});

await pg.goto(page_url);
await pg.waitForTimeout(800);

const stamp = await pg.textContent('#buildStamp');
if (!stamp || !stamp.includes('Build')) fails.push('build stamp missing');

/* A fresh launch asks for one tap (Chrome will not start sound, speech or
   fullscreen from a gamepad), and that tap lands on the stereo game picker —
   never a flat panel */
const firstMenu = await pg.evaluate(() => GH.menu.id);
if (firstMenu !== 'tapStart') fails.push(`a fresh launch opened "${firstMenu}", expected the tap-to-start screen`);
await pg.mouse.click(450, 220);
await pg.waitForTimeout(200);
const booted = await pg.evaluate(() => ({ menu: GH.menu.id, screens: GH.screens().length, games: GH.games() }));
if (booted.menu !== 'title') fails.push(`the first tap opened "${booted.menu}", expected the game picker`);
if (booted.screens < 20) fails.push(`only ${booted.screens} stereo screens registered`);
for (const id of ['islands', 'truck', 'blocks', 'rocks', 'race', 'shop'])
  if (booted.games.indexOf(id) < 0) fails.push(`the game picker has no "${id}"`);

/* every synthesised effect has to be callable without throwing */
const sfxErrors = await pg.evaluate(() => {
  const errs = [];
  const a = GH.audio();
  for (const n of Object.keys(GH.TUNING.audio)) void n;
  ['uiMove','uiOk','uiBack','swing','hitFoe','foeDie','hurt','shot','pickup','keyGet',
   'unlock','locked','roomClear','stepDown','stepUp','win','lose','bossWake','target',
   'star','oops','fanfare','charged','spin','bug','frog','split','windup','ring','quake',
   'go','levelUp','trophy','bump','oof','bMove','bRotate','bLock','bDrop','bLine','bBig','bGem',
   'bSweep','laser','rockHit','saucer','powerUp','shield','shipHit','overtake','skid','crash',
   'nitro','checkpoint','hop','land','crunch','honk','transform','splash','bubble','balloon','flip']
   .forEach((n) => { try { GH.sfx(n, 2); } catch (e) { errs.push(n + ': ' + e.message); } });
  return { errs, effects: a.effects, failed: a.failed };
});
if (sfxErrors.errs.length) fails.push('sfx threw: ' + sfxErrors.errs.join(', '));
if (sfxErrors.effects < 60) fails.push(`only ${sfxErrors.effects} sound effects defined`);

/* Every menu must reach both eyes identically — that is the fusion lock.
   The two exceptions are named here rather than left to slip under a
   threshold: they present different bars to each eye on purpose, because
   that IS the measurement. */
const EYE_ASYMMETRIC = ['nonius', 'kidSticks'];
const menuDiff = await pg.evaluate((skip) => {
  const measure = (id) => {
    GH.cfg.lens = 'off'; GH.open(id); GH.redraw();
    const c = document.getElementById('view');
    const t = document.createElement('canvas');
    t.width = c.width; t.height = c.height;
    t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const half = c.width >> 1, m = 6;   // skip the seam and the outer edge
    let diff = 0, total = 0;
    for (let y = m; y < c.height - m; y++) {
      for (let x = m; x < half - m; x++) {
        const i = (y * c.width + x) * 4, j = (y * c.width + x + half) * 4;
        total++;
        if (Math.abs(d[i] - d[j]) > 8) diff++;
      }
    }
    return (100 * diff) / Math.max(total, 1);
  };
  const out = {};
  for (const id of GH.screens()) if (skip.indexOf(id) < 0) out[id] = measure(id);
  const asym = {};
  for (const id of skip) asym[id] = measure(id);
  return { out, asym, checked: Object.keys(out).length };
}, EYE_ASYMMETRIC);
for (const [id, pct] of Object.entries(menuDiff.out)) {
  if (pct > 1) fails.push(`screen "${id}" differs between the eyes by ${pct.toFixed(2)}% — menu chrome must be binocular`);
}
/* and the measurement screens must actually still differ, or the nonius test
   has quietly stopped testing anything */
for (const [id, pct] of Object.entries(menuDiff.asym)) {
  if (pct < 0.05) fails.push(`screen "${id}" is identical in both eyes — its per-eye bars have stopped being drawn`);
}

/* child mode changes the shape of the game, not just the numbers */
const child = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.cfg.kidMode = true; GH.play(); await s(400);
  const base = GH.TUNING.player.maxHp, extra = GH.TUNING.session.extraHearts * 2;
  const foe = GH.game.foes[0];
  const out = { maxhp: GH.game.p.maxhp, want: base + extra,
                foeSpd: foe ? foe.spd : null,
                wantSpd: foe ? GH.TUNING[foe.type].speed * GH.TUNING.session.foeSpeedScale : null };
  GH.game.p.hp = 1;
  GH.game.p.inv = 0;
  GH.sfx && null;
  return out;
});
if (child.maxhp !== child.want) fails.push(`child mode gave ${child.maxhp} hp, expected ${child.want}`);
if (child.foeSpd != null && Math.abs(child.foeSpd - child.wantSpd) > 1e-6)
  fails.push(`child mode foe speed ${child.foeSpd}, expected ${child.wantSpd}`);

/* catch trials have to separate a real threshold from a mashed button */
const trials = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const run = async (honest) => {
    GH.cfg.strong = 0.4; GH.cfg.kidSet = false; GH.open('kidHunt'); await s(120);
    for (let i = 0; i < 60 && GH.menu.id === 'kidHunt'; i++) {
      GH.hunt.shown = true; GH.hunt.hold = 9999;
      if (!honest || !GH.hunt.blank) GH.confirm(); else GH.hunt.hold = 1;
      await s(25);
    }
    return { verdict: GH.menu.id, fa: GH.hunt.fa, blanks: GH.hunt.blanks,
             unreliable: !!GH.hunt.unreliable, strong: GH.cfg.strong };
  };
  const masher = await run(false);
  const honest = await run(true);
  return { masher, honest };
});
if (trials.masher.verdict !== 'kidRetry')
  fails.push(`a mashed wizard run was accepted (ended on "${trials.masher.verdict}", ${trials.masher.fa} false alarms) — catch trials are not discriminating`);
if (Math.abs(trials.masher.strong - 0.4) > 1e-6)
  fails.push('a mashed wizard run still wrote a contrast into cfg.strong');
if (trials.honest.verdict !== 'kidSticks')
  fails.push(`an honest wizard run was rejected (ended on "${trials.honest.verdict}")`);
if (trials.honest.fa !== 0) fails.push(`honest run recorded ${trials.honest.fa} false alarms`);

/* the child wizard: a descending staircase that ends on a usable contrast.
   This plays HONESTLY — it lets catch trials time out instead of pressing on
   them. Written before catch trials existed, it used to press every round,
   which made it a button-masher the app now rightly rejects; and a blank
   round does not move the contrast, so logging it broke the monotonic check. */
const kid = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.cfg.strong = 0.4; GH.open('kidHunt'); await s(120);
  const presented = [];
  for (let i = 0; i < 40 && GH.menu.id === 'kidHunt'; i++) {
    GH.hunt.shown = true;
    if (GH.hunt.blank) { GH.hunt.hold = 1; await s(40); continue; }
    GH.hunt.hold = 9999;
    presented.push(+GH.hunt.c.toFixed(3));
    GH.confirm(); await s(40);
  }
  return { presented, ended: GH.menu.id, strong: GH.cfg.strong, kidSet: GH.cfg.kidSet };
});
if (kid.ended !== 'kidSticks') fails.push(`child wizard ended on "${kid.ended}", expected the stick question`);
if (!(kid.presented.length >= 4)) fails.push(`wizard only presented ${kid.presented.length} rounds`);
if (!kid.presented.every((v, i, a) => i === 0 || v < a[i - 1])) fails.push('wizard contrast did not descend monotonically');
if (!(kid.strong > 0.04 && kid.strong <= 1)) fails.push(`wizard produced an unusable contrast: ${kid.strong}`);
if (!kid.kidSet) fails.push('wizard did not flag cfg.kidSet');

/* ---------------- the islands ----------------
   Every island the sea can offer, plus fifty more seeds, must be winnable:
   matching doors, no enemy inside a wall (island 1 had nine), clear push
   lanes, and a warden's key reachable before its lock. */
const islands = await pg.evaluate(() => GH.islandCheck(1, 60));
const brokenIslands = islands.filter((x) => x.problems.length || x.fallback);
for (const x of brokenIslands.slice(0, 5)) fails.push(`island ${x.n}: ${x.fallback ? 'fell back to home; ' : ''}${x.problems.slice(0, 3).join('; ')}`);

/* the clue layer: faint in the stronger eye, weak-eye-only in forced fusion */
const clue = await pg.evaluate(() => {
  const weak = GH.cfg.weakEye, strong = weak === 'left' ? 'right' : 'left', keep = [GH.cfg.mode, GH.cfg.strong];
  GH.cfg.strong = 0.3;
  GH.cfg.mode = 'rebalance'; const r = [GH.alphaFor(weak, 'clue'), GH.alphaFor(strong, 'clue')];
  GH.cfg.mode = 'split';     const s = [GH.alphaFor(weak, 'clue'), GH.alphaFor(strong, 'clue')];
  GH.cfg.mode = keep[0]; GH.cfg.strong = keep[1];
  return { r, s };
});
if (clue.r[0] !== 1 || Math.abs(clue.r[1] - 0.3) > 1e-9) fails.push(`clue layer in rebalance is ${clue.r}, expected [1, 0.3]`);
if (clue.s[0] !== 1 || clue.s[1] !== 0) fails.push(`clue layer in forced fusion is ${clue.s}, expected weak-eye only`);

/* the mechanics, driven through the real update() with the live loop frozen
   so nothing but the test is moving the world */
const mech = await pg.evaluate(() => {
  const out = {};
  const begin = (island, room) => {
    GH.cfg.kidMode = true; GH.loadIsland(island); GH.session.ended = true; GH.play(); GH.freeze();
    if (room) GH.room(room);
    GH.game.foes.length = 0; GH.game.sealed = false;
    const I = GH.input; I.x = I.y = 0; I.atk = I.tool = I.toolPress = I.cycle = false;
  };
  const I = () => GH.input;

  /* cut a bush: Threshold has one at (1,2); stand below it and swing north */
  begin(1);
  GH.tp(1, 3, 'n'); I().atk = true; GH.step(20);
  out.bushCut = GH.game.grid[2][1] === 0;

  /* push the Cache's stone three tiles south onto its plate */
  begin(1, '2,0');
  GH.tp(4, 3, 's'); I().y = 1; GH.step(160); I().y = 0; GH.step(20);
  const cache = GH.game.objs;
  out.pushSolved = !!cache.find((o) => o.k === 'block' && o.x === 4 && o.y === 7);
  out.pushChest = !!cache.find((o) => o.k === 'chest' && o.shown);

  /* bombs open the Rookery's cracked wall; the chest behind it gives coins */
  begin(1, '2,2');
  GH.grant('bombs');
  GH.tp(9, 1, 'e'); I().toolPress = true; GH.step(GH.TUNING.tools.bombFuse + 6);
  out.crackOpen = GH.game.grid[1][10] === 0;
  const coins0 = GH.game.coins;
  GH.tp(10, 1, 'e'); I().atk = true; GH.step(2);
  out.chestHeld = !!GH.game.hold;
  GH.step(100);
  out.chestCoins = GH.game.coins - coins0;

  /* an arrow into the Cistern's eye switch reveals its chest */
  begin(1, '0,2');
  GH.grant('bow');
  GH.tp(9, 2, 'n'); I().toolPress = true; GH.step(40);
  out.eyeHit = !!GH.game.objs.find((o) => o.k === 'eye' && o.hit);
  out.eyeChest = !!GH.game.objs.find((o) => o.k === 'chest' && o.hidden === 'eye' && o.shown);

  /* a generated torch island: light every torch in its key room */
  const isl = GH.islandCheck(3, 3)[0];
  begin(3);
  GH.room(GH.island.keyRoom); GH.game.foes.length = 0; GH.game.sealed = false;
  const torches = GH.game.objs.filter((o) => o.k === 'torch');
  for (const t of torches) {
    const left = t.x < 6;
    GH.tp(left ? t.x + 1 : t.x - 1, t.y, left ? 'w' : 'e');
    I().atk = true; GH.step(24);
  }
  out.torches = torches.length;
  out.torchSolved = !!GH.game.objs.find((o) => o.k === 'chest' && o.shown && o.hidden === 'puzzle');
  out.island3Rooms = isl.rooms;

  /* the warden leaves a light; picking it up ends the island */
  begin(1, '1,0');
  GH.game.foes.length = 0;
  GH.game.foes.push(Object.assign({}, { type:'boss', x:6*16+8, y:3*16+8, vx:0, vy:0, hurt:0, t:1, hp:1, w:26, h:26, spd:0, dmg:0, state:'wait', cd:9999, spawned:0 }));
  GH.tp(6, 4, 'n'); I().atk = true; GH.step(12);
  const orb = GH.game.items.find((it) => it.type === 'orb');
  out.orbDropped = !!orb;
  if (orb) { GH.game.p.x = orb.x; GH.game.p.y = orb.y; GH.step(2); GH.step(100); }
  out.won = !!GH.game.won;
  out.lit1 = !!GH.prog.lit[1];
  return out;
}).catch((e) => ({ error: e.message }));
if (mech.error) fails.push('mechanics test threw: ' + mech.error);
else {
  if (!mech.bushCut) fails.push('swinging at a bush did not cut it');
  if (!mech.pushSolved) fails.push('pushing the Cache stone did not land it on the plate');
  if (!mech.pushChest) fails.push('solving the push puzzle did not reveal its chest');
  if (!mech.crackOpen) fails.push('a bomb did not open the cracked wall');
  if (!mech.chestHeld) fails.push('opening a chest did not hold the item up');
  if (!(mech.chestCoins >= 15)) fails.push(`the secret chest gave ${mech.chestCoins} coins, expected 15`);
  if (!mech.eyeHit || !mech.eyeChest) fails.push('an arrow into the eye switch did not reveal its chest');
  if (!(mech.torches >= 3) || !mech.torchSolved) fails.push(`lighting ${mech.torches} torches did not solve island 3's key room`);
  if (!mech.orbDropped) fails.push('the warden did not drop its light');
  if (!mech.won || !mech.lit1) fails.push('picking up the light did not finish the island');
}

/* the sitting clock survives a replay (it used to reset with every run) */
const sit = await pg.evaluate(() => {
  GH.sit.ms = 5000; GH.sit.done = false; GH.session.ended = true; GH.loadIsland(1); GH.play(); GH.freeze();
  return GH.sit.ms;
});
if (!(sit >= 5000)) fails.push(`starting a new run reset the sitting clock to ${sit}`);

/* the sea: pick island 2, sail, and arrive */
const sail = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.cfg.allIslands = true; GH.prog.lastIsland = 1;
  GH.open('map'); await s(60);
  GH.nav(1, 0); GH.confirm();
  /* the sail is frame-counted, and a headless page can run well under 60 fps,
     so wait for the arrival rather than for a fixed time */
  for (let i = 0; i < 100 && !(GH.island && GH.island.id === 2 && GH.running); i++) await s(80);
  GH.cfg.allIslands = false;
  return { island: GH.island && GH.island.id, running: GH.running, menu: GH.menu.id };
});
if (sail.island !== 2 || !sail.running) fails.push(`sailing from the map landed on island ${sail.island} (menu "${sail.menu}")`);
await pg.evaluate(() => { GH.freeze(); GH.loadIsland(1); GH.session.ended = true; });

/* ---------------- the dungeon, grown ----------------
   spin attack, the two new foes, every island's warden fighting its own way,
   and glow-bugs on the clue layer */
const grown = await pg.evaluate(() => {
  const out = {};
  const I = () => GH.input;
  const begin = (island, room) => {
    GH.cfg.kidMode = true; GH.loadIsland(island); GH.session.ended = true; GH.play(); GH.freeze();
    if (room) GH.room(room);
    GH.game.foes.length = 0; GH.game.sealed = false;
    const i = GH.input; i.x = i.y = 0; i.atk = i.tool = i.toolPress = i.cycle = i.act = false;
  };
  const grub = (tx, ty) => { const f = { type:'grub', x:tx*16+8, y:ty*16+8, vx:0, vy:0, hurt:0, t:1, hp:3, w:13, h:13, spd:0, dmg:1 }; GH.game.foes.push(f); return f; };
  begin(1, '1,1');
  GH.tp(3, 5, 's');
  const a = grub(4, 5), b = grub(2, 5);
  I().act = true; GH.step(GH.TUNING.player.spinChargeFrames + 4);
  out.charged = GH.game.p.charge >= GH.TUNING.player.spinChargeFrames;
  I().act = false; GH.step(20);
  out.spinHitBoth = a.hp < 3 && b.hp < 3;
  begin(1, '1,1');
  GH.tp(6, 8, 'n');
  GH.game.foes.push({ type:'slime', x:6*16+8, y:7*16+8, vx:0, vy:0, hurt:0, t:1, hp:1, w:13, h:13, spd:0, dmg:1 });
  I().atk = true; GH.step(14);
  out.halves = GH.game.foes.filter((f) => f.type === 'slime' && f.small).length;
  begin(1, '2,1');
  out.bugs = GH.game.bugs.length;
  const bug = GH.game.bugs[0], c0 = GH.game.coins;
  if (bug) { GH.game.p.x = bug.x; GH.game.p.y = bug.y + 3; GH.step(2); }
  out.bugCoin = GH.game.coins - c0;
  out.wardens = {};
  for (const n of [1, 2, 3, 4]) {
    GH.cfg.kidMode = true; GH.loadIsland(n); GH.session.ended = true; GH.play(); GH.freeze();
    GH.room(GH.island.boss);
    const boss = GH.game.foes.find((f) => f.type === 'boss');
    GH.tp(6, 8, 'n'); GH.game.p.hp = GH.game.p.maxhp = 99;
    let shots = 0, foes = 0, z = 0, quake = false;
    for (let k = 0; k < 400; k++) {
      GH.step(1); GH.game.p.inv = 5;
      shots = Math.max(shots, GH.game.shots.length); foes = Math.max(foes, GH.game.foes.length);
      z = Math.max(z, boss.z || 0); if (GH.game.fx.some((e) => e.type === 'quake')) quake = true;
    }
    out.wardens[n] = { pattern: boss.pattern, shots, foes, z, quake, intense: GH.dungeonIntense() };
  }
  return out;
}).catch((e) => ({ error: e.message }));
if (grown.error) fails.push('dungeon test threw: ' + grown.error);
else {
  if (!grown.charged || !grown.spinHitBoth) fails.push('holding and releasing the action did not spin the sword into both foes');
  if (grown.halves !== 2) fails.push(`a beaten slime left ${grown.halves} halves, expected 2 that survive the swing`);
  const W = grown.wardens;
  if (!(grown.bugs >= 2) || grown.bugCoin < 1) fails.push(`glow-bugs: ${grown.bugs} in the room, catching one gave ${grown.bugCoin} coins`);
  if (W[1].pattern !== 'charge' || W[2].pattern !== 'ring' || W[3].pattern !== 'summon' || W[4].pattern !== 'leap')
    fails.push('wardens do not fight differently: ' + [1, 2, 3, 4].map((n) => W[n].pattern).join(','));
  if (W[2].shots < 8) fails.push(`the ring warden fired at most ${W[2].shots} shots at once`);
  if (W[3].foes < 3) fails.push('the summoning warden never called anything');
  if (!(W[4].z > 10) || !W[4].quake) fails.push('the leaping warden never leapt and landed');
  if (W[1].intense !== 1) fails.push('a warden fight is not an intense moment for the music');
}

/* ---------------- the arcade games ----------------
   every game draws per-eye, reports what its layers hold, steps the staircase
   per segment, and in child mode never ends a run on failure */
const shotDiff = async () => pg.evaluate(() => {
  const c = document.getElementById('view');
  const shot = () => { const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); return t.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
  GH.cfg.strong = 1.0; GH.redraw(); const a = shot();
  GH.cfg.strong = 0.1; GH.redraw(); const b = shot();
  let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 6) n++;
  return n;
});
const arcade = {};
for (const id of ['truck', 'blocks', 'rocks', 'race']) {
  await pg.evaluate((id) => {
    GH.cfg.kidMode = true; GH.cfg.mode = 'rebalance'; GH.cfg.lens = 'off'; GH.cfg.adapt = true;
    GH.arcade(id, 1); GH.freeze();
    const I = GH.input; I.x = I.y = 0; I.atk = I.tool = I.toolPress = I.cycle = I.act = false;
    GH.astep(id === 'truck' ? 1 : 30);
  }, id);
  const px = await shotDiff();
  arcade[id] = { px, busy: await pg.evaluate(() => GH.busy()) };
}
for (const [id, r] of Object.entries(arcade)) {
  if (r.px < 50) fails.push(`${id}: dropping stronger-eye contrast changed only ${r.px} px — its per-eye layers are not drawn per eye`);
  if (!r.busy || !(r.busy.foe || r.busy.item || r.busy.clue)) fails.push(`${id}: busy() reports nothing on any per-eye layer at the start`);
}

const mech2 = await pg.evaluate(() => {
  const out = {}, cap = GH.TUNING.session.stepUpsPerRoom;
  const reset = () => { const I = GH.input; I.x = I.y = 0; I.atk = I.tool = I.toolPress = I.cycle = I.act = false; };
  const start = (id, lv) => { GH.cfg.kidMode = true; GH.cfg.adapt = true; GH.cfg.strong = 0.5; GH.arcade(id, lv); GH.freeze(); reset(); return GH.arc.g; };

  /* Blocks: a completed row clears, and its gem pays a star */
  let g = start('blocks', 1);
  for (let x = 1; x < 10; x++) g.grid[19][x] = { c:'#e0645a', hi:'#f2aaa2', gem: x === 5 };
  g.cur = { type:'I', rot:1, x:-2, y:0, gem:-1 };
  GH.input.toolPress = true; GH.astep(1); GH.astep(GH.TUNING.blocks.clearFrames + 3);
  out.blocksLines = g.lines; out.blocksGem = GH.session.bonusStars;
  /* ... and topping out in child mode sweeps instead of ending, stepping up at most the cap */
  g = start('blocks', 1);
  for (let k = 0; k < 3; k++){
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) if (x !== 4) g.grid[y][x] = { c:'#5a7de8', hi:'#a9bcf6', gem:false };
    g.cur = null; GH.astep(1); GH.astep(50);
  }
  out.blocksTopouts = g.topouts; out.blocksOver = GH.arc.over; out.blocksUps = GH.session.stepsUp;

  /* Space Rocks: repeated hits in child mode never end it, and step up at most the cap */
  g = start('rocks', 1);
  /* each hit freezes the game for a few frames (hit-stop), so clear it between hits */
  for (let k = 0; k < 4; k++){ g.ship.inv = 0; g.shield = 0; GH.arc.hit = 0; const r = g.rocks[0]; r.x = g.ship.x; r.y = g.ship.y; GH.astep(1); }
  out.rocksHits = GH.session.hits; out.rocksUps = GH.session.stepsUp; out.rocksOver = GH.arc.over;
  /* a clean wave steps the stronger eye down */
  g = start('rocks', 1);
  const c0 = GH.cfg.strong;
  g.rocks.length = 0; GH.astep(3);
  out.rocksClean = GH.session.cleanRooms; out.rocksDown = GH.cfg.strong < c0;

  /* Racer: bumping a rival costs speed and one step at most; the finish places him */
  g = start('race', 1);
  for (let k = 0; k < 3; k++){ const r = g.rivals[0]; g.p.spin = 0; r.spin = 0; GH.arc.hit = 0; r.d = g.p.d; r.x = g.p.x - GH.raceCentre(r.d); GH.astep(1); }
  out.raceCrashes = g.crashes;
  out.raceUps = GH.session.stepsUp;
  g.p.d = g.len - 3; g.p.v = 2; g.p.spin = 0; GH.arc.hit = 0; GH.astep(8);
  out.raceWon = GH.arc.won; out.racePlace = GH.session.place; out.raceLevel = GH.prog.games.race.level;
  GH.arcadeEnd();
  out.doneMenu = GH.menu.id;
  GH.confirm();
  out.nextLevel = GH.session.level; out.nextRunning = GH.running;
  GH.freeze();

  /* Gator Truck: the big truck cannot enter a tunnel; B at the sign makes it a
     mini that can; in child mode it changes by itself if the sign is missed */
  g = start('truck', 4);
  let gate = g.gates.find((q) => q.form === 'mini'), tun = g.tunnels[0];
  g.t.x = gate.x - 10; g.t.y = 120; g.t.vx = 0;
  GH.input.x = 1; GH.astep(160);
  out.truckBlocked = g.t.x < tun.x0 && g.t.form === 'truck';
  GH.arc.hit = 0; GH.input.toolPress = true; GH.astep(1);
  out.truckMini = g.t.form === 'mini';
  GH.astep(500);
  out.truckThrough = g.t.x > tun.x1;
  g = start('truck', 4);
  gate = g.gates.find((q) => q.form === 'mini');
  g.t.x = gate.x - 10; g.t.y = 120; g.t.vx = 0;
  GH.input.x = 1; GH.astep(Math.round(GH.TUNING.truck.autoSec * 60) + 260);
  out.truckAuto = g.t.form === 'mini';
  /* the lake: a sub swims it */
  g = start('truck', 5);
  gate = g.gates.find((q) => q.form === 'sub'); const lake = g.lakes[0];
  g.t.x = gate.x; g.t.y = 120; g.t.vx = 0; GH.arc.hit = 0;
  GH.input.toolPress = true; GH.astep(1);
  out.truckSub = g.t.form === 'sub';
  GH.input.x = 1; GH.astep(900);
  out.truckAcross = g.t.x > lake.x1;
  return out;
}).catch((e) => ({ error: e.message + ' ' + (e.stack || '').split('\n')[1] }));
if (mech2.error) fails.push('arcade mechanics test threw: ' + mech2.error);
else {
  const cap = 1;
  if (mech2.blocksLines !== 1) fails.push(`Blocks: a completed row cleared ${mech2.blocksLines} lines, expected 1`);
  if (mech2.blocksGem < 1) fails.push('Blocks: clearing a gem row paid no star');
  if (mech2.blocksTopouts < 3 || mech2.blocksOver) fails.push(`Blocks: child-mode top-outs (${mech2.blocksTopouts}) ended the run`);
  if (mech2.blocksUps > cap) fails.push(`Blocks: ${mech2.blocksUps} step-ups in one segment — child mode caps it at ${cap}`);
  if (mech2.rocksHits < 3 || mech2.rocksOver) fails.push(`Space Rocks: ${mech2.rocksHits} hits in child mode, over=${mech2.rocksOver}`);
  if (mech2.rocksUps > cap) fails.push(`Space Rocks: ${mech2.rocksUps} step-ups in one wave — child mode caps it at ${cap}`);
  if (mech2.rocksClean !== 1 || !mech2.rocksDown) fails.push('Space Rocks: a clean wave did not step the stronger eye down');
  if (mech2.raceCrashes < 3) fails.push(`Racer: driving into a rival crashed ${mech2.raceCrashes} of 3 times`);
  if (mech2.raceUps > cap) fails.push(`Racer: ${mech2.raceUps} step-ups in one quarter`);
  if (!mech2.raceWon || !(mech2.racePlace >= 1 && mech2.racePlace <= 6)) fails.push(`Racer: crossing the line did not place him (won=${mech2.raceWon}, place=${mech2.racePlace})`);
  if (mech2.raceLevel !== 2) fails.push(`Racer: finishing level 1 left the next level at ${mech2.raceLevel}`);
  if (mech2.doneMenu !== 'arcadeDone' || mech2.nextLevel !== 2 || !mech2.nextRunning) fails.push(`end of level: menu "${mech2.doneMenu}", NEXT started level ${mech2.nextLevel}`);
  if (!mech2.truckBlocked) fails.push('Gator Truck: the big truck drove into the tunnel');
  if (!mech2.truckMini || !mech2.truckThrough) fails.push('Gator Truck: B at the gate did not make a mini that gets through the tunnel');
  if (!mech2.truckAuto) fails.push('Gator Truck: in child mode a missed sign did not transform the truck by itself');
  if (!mech2.truckSub || !mech2.truckAcross) fails.push('Gator Truck: the sub did not get across the lake');
}

/* Gator Truck handling: a child who just holds the stick (the gas) must get
   through every course without crashing — the stick once also leaned the truck
   in the air, and holding the gas crashed it on nearly every landing. Ramps
   must throw the truck into real air, holding A there must flip it and still
   land in child mode, and the sub must not turn back into a truck in water. */
const truckFeel = await pg.evaluate(() => {
  const out = { courses: [] };
  const I = GH.input;
  const reset = () => { I.x = I.y = 0; I.atk = I.tool = I.toolPress = I.cycle = I.act = false; };
  for (const lv of [1, 2, 3, 4, 5, 6]) {
    GH.cfg.kidMode = true; GH.arcade('truck', lv); GH.freeze(); reset();
    const g = GH.arc.g, t = g.t;
    let maxAir = 0;
    for (let f = 0; f < 60 * 60 && !GH.arc.won; f++) {
      I.x = 1;
      I.atk = t.grounded && !!g.boulders.find((q) => q.x > t.x && q.x - t.x < 30);
      const gate = g.gates.find((q) => t.x > q.x - 40 && t.x < q.x + 40 && q.form !== t.form);
      I.toolPress = !!gate && f % 30 === 0;
      I.act = !t.grounded;
      GH.arc.hit = 0; GH.astep(1);
      maxAir = Math.max(maxAir, t.air);
    }
    out.courses.push({ lv, crashes: g.crashes, done: GH.arc.won, maxAir, flips: g.flipStars });
  }
  /* B at the exit sign while still swimming: stays a sub, stays in the lake */
  GH.cfg.kidMode = true; GH.arcade('truck', 5); GH.freeze(); reset();
  const g = GH.arc.g, lake = g.lakes[0], exitGate = g.gates.find((q) => q.form === 'truck');
  g.t.form = 'sub'; g.t.x = lake.x1 - 20; g.t.y = lake.wy + 10; g.t.grounded = true;
  I.toolPress = true; GH.astep(1); GH.astep(5);
  out.wetStaysSub = g.t.form === 'sub' && g.t.x > lake.x0 + 100 && exitGate.x - g.t.x < 80;
  return out;
});
for (const c of truckFeel.courses) {
  if (c.crashes > 0 || !c.done) fails.push(`Gator Truck level ${c.lv}: holding the gas crashed ${c.crashes} times (finished=${c.done})`);
}
if (!truckFeel.courses.some((c) => c.maxAir >= 30)) fails.push('Gator Truck: no ramp threw the truck into real air');
if (!truckFeel.courses.some((c) => c.flips > 0)) fails.push('Gator Truck: holding A in the air never flipped the truck');
if (!truckFeel.wetStaysSub) fails.push('Gator Truck: B at the exit sign made a truck in the water (it used to send him back to the start of the lake)');

/* exposure telemetry and the session log, with the real loop running */
const expo = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.cfg.kidMode = true; GH.arcade('rocks', 1);
  /* a headless page can run at a few frames a second, and each frame counts
     at most 120 ms — so wait for the exposure, not for a fixed time */
  for (let i = 0; i < 250 && GH.session.sig.foe < 1100; i++) await s(80);
  const rec = GH.record();
  GH.freeze();
  return { activity: rec.activity, foeSec: rec.exposure.foeSec, rooms: rec.rooms.length };
});
if (expo.activity !== 'rocks' || !(expo.foeSec >= 1) || expo.rooms < 1)
  fails.push(`arcade session log: activity ${expo.activity}, foe exposure ${expo.foeSec}s, ${expo.rooms} segment(s)`);

/* finishing an island opens the next one, whatever the stars, and the boat
   sails straight there */
const nextIsl = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.freeze();
  const stars = GH.prog.stars; GH.prog.stars = 0; GH.cfg.allIslands = false;
  GH.prog.lit[1] = true;
  const open2 = GH.unlocked(2), open3 = GH.unlocked(3);
  GH.loadIsland(1); GH.session.ended = true; GH.play(); GH.freeze();
  GH.session.won = true; GH.open('summary'); GH.confirm();
  for (let i = 0; i < 100 && !(GH.island && GH.island.id === 2 && GH.running); i++) await s(80);
  const out = { open2, open3, island: GH.island && GH.island.id, running: GH.running };
  GH.freeze(); GH.prog.stars = stars; GH.loadIsland(1); GH.session.ended = true;
  return out;
});
if (!nextIsl.open2) fails.push('finding island 1\'s light did not open island 2');
if (nextIsl.open3) fails.push('island 3 opened with no stars and island 2 unfinished');
if (nextIsl.island !== 2 || !nextIsl.running) fails.push(`NEXT ISLAND landed on island ${nextIsl.island}`);

/* the game picker: the stick moves it, A plays the game under it, holding B
   (not tapping it) opens the grown-up screen */
const hub = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.freeze(); GH.open('title');
  const l = GH.games(), before = GH.hub.sel;
  GH.nav(1, 0);
  const moved = GH.hub.sel !== before;
  GH.hub.sel = l.indexOf('blocks'); GH.confirm();
  await s(80);
  const out = { moved, arc: GH.arc.id, running: GH.running };
  GH.freeze(); GH.open('title');
  return out;
});
if (!hub.moved) fails.push('the stick did not move the game picker');
if (hub.arc !== 'blocks' || !hub.running) fails.push(`A on Blocks started "${hub.arc}" (running=${hub.running})`);
await pg.keyboard.press('Escape');
await pg.waitForTimeout(150);
const quickB = await pg.evaluate(() => GH.menu.id);
if (quickB !== 'title') fails.push(`a quick B on the picker went to "${quickB}" — only a held B should`);
await pg.keyboard.down('Escape');
/* the hold is frame-counted; a headless page can be slow, so poll for it */
for (let i = 0; i < 300 && (await pg.evaluate(() => GH.menu.id)) !== 'adult'; i++) await pg.waitForTimeout(80);
await pg.keyboard.up('Escape');
const heldB = await pg.evaluate(() => GH.menu.id);
if (heldB !== 'adult') fails.push(`holding B on the picker opened "${heldB}", expected the grown-up screen`);

/* the paint shop spends the wallet, never the lifetime count */
const shop = await pg.evaluate(() => {
  GH.prog.wallet = 100; const coins = GH.prog.coins;
  GH.open('shop'); GH.nav(1, 0); GH.confirm();
  return { wallet: GH.prog.wallet, coinsSame: GH.prog.coins === coins, sel: GH.prog.paint.hero && GH.prog.paint.hero.sel };
});
if (shop.wallet !== 65 || !shop.coinsSame || shop.sel !== 1) fails.push(`paint shop: wallet ${shop.wallet}, lifetime coins unchanged ${shop.coinsSame}, colour ${shop.sel}`);

/* speech: with no Mongolian voice the ENGLISH line is spoken, by an English voice */
const speech = await pg.evaluate(() => {
  const ss = window.speechSynthesis, spoken = [];
  const U = window.SpeechSynthesisUtterance, gv = ss.getVoices, sp = ss.speak;
  ss.getVoices = () => [{ lang:'en-US', name:'Test English' }];
  ss.speak = (u) => spoken.push(u.text);
  window.SpeechSynthesisUtterance = function(t){ this.text = t; };
  GH.cfg.speakLang = 'mn'; GH.cfg.mute = false;
  const status = GH.speech();
  GH.say({ mn:'Сайн байна уу', en:'Hello there' });
  window.SpeechSynthesisUtterance = U; ss.getVoices = gv; ss.speak = sp;
  return { status, spoken };
});
if (!/english/.test(speech.status) || speech.spoken.join('|') !== 'Hello there')
  fails.push(`speech without a Mongolian voice: status "${speech.status}", spoke ${JSON.stringify(speech.spoken)}`);

/* the carol: a warden fight brings it in, and mute silences it */
const carol = await pg.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  GH.cfg.mute = false; GH.cfg.music = true;
  GH.loadIsland(1); GH.session.ended = true; GH.play(); GH.freeze();
  GH.room('1,0');
  for (let k = 0; k < 20; k++){ GH.musicTick(GH.dungeonIntense()); await s(16); }
  const on = GH.music().on, ctx = GH.audio().ctx;
  GH.cfg.mute = true; GH.musicTick(1);
  const muted = !GH.music().on;
  GH.cfg.mute = false;
  return { on, muted, ctx };
});
if (carol.ctx === 'running' && !carol.on) fails.push('a warden fight did not bring the carol in');
if (!carol.muted) fails.push('mute did not silence the carol');

/* the flat panels can no longer strand a launch: they have a way back, and a
   reload always comes up in the viewer menus */
await pg.evaluate(() => GH.flat());
await pg.click('#btnStereo');
const back = await pg.evaluate(() => ({ menu: GH.menu.id, flat: GH.cfg.flat }));
/* the picker, or the pause screen when a run is waiting behind it */
if ((back.menu !== 'title' && back.menu !== 'pause') || back.flat) fails.push(`"Back to the viewer menus" left menu "${back.menu}", flat=${back.flat}`);
await pg.evaluate(() => GH.flat());
await pg.reload();
await pg.waitForTimeout(700);
const relaunch = await pg.evaluate(() => ({ menu: GH.menu.id, flat: GH.cfg.flat, panel: !document.getElementById('pTitle').hidden }));
if (relaunch.flat || relaunch.panel || (relaunch.menu !== 'tapStart' && relaunch.menu !== 'title'))
  fails.push(`a relaunch after "Flat menus" came up flat (menu "${relaunch.menu}", panel shown ${relaunch.panel})`);
await pg.mouse.click(450, 220);
await pg.waitForTimeout(200);

/* dev panel builds a control per numeric leaf (it lives in the flat panel) */
await pg.evaluate(() => GH.flat());
await pg.click('#btnDevTitle');
await pg.waitForTimeout(300);
const sliders = await pg.evaluate(() => document.querySelectorAll('#devFields input[type=range]').length);
if (sliders < 40) fails.push(`dev panel only built ${sliders} sliders`);
await pg.click('#btnDevBack');
await pg.evaluate(() => GH.stereo());

/* the two eyes must actually differ where a foe is drawn */
await pg.evaluate(() => GH.play());
await pg.waitForTimeout(700);
const diff = await pg.evaluate(() => {
  GH.cfg.mode = 'rebalance';
  GH.cfg.strong = 1.0; GH.redraw();
  const c = document.getElementById('view');
  const shot = () => {
    const t = document.createElement('canvas');
    t.width = c.width; t.height = c.height;
    t.getContext('2d').drawImage(c, 0, 0);
    return t.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  };
  const a = shot();
  GH.cfg.strong = 0.1; GH.redraw();
  const b = shot();
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 6) changed++;
  return changed;
});
if (diff < 50) fails.push(`dropping stronger-eye contrast changed almost nothing (${diff} px) — the dichoptic path may be broken`);

/* pausing goes to the stereo pause screen, not a flat panel */
await pg.keyboard.press('Escape');
await pg.waitForTimeout(300);
const paused = await pg.evaluate(() => GH.menu.id);
if (paused !== 'pause') fails.push(`Escape opened "${paused}", expected the stereo pause screen`);
await pg.evaluate(() => GH.play());
await pg.waitForTimeout(200);

/* session log */
for (const k of ['ArrowUp', 'ArrowRight', ' ']) {
  await pg.keyboard.down(k); await pg.waitForTimeout(200); await pg.keyboard.up(k);
}
const rec = await pg.evaluate(() => GH.record());
if (!rec.rooms || !rec.rooms.length) fails.push('session log has no rooms');
if (!rec.build) fails.push('session log has no build stamp');

await browser.close();
if (fails.length) { fails.forEach((f) => console.log('FAIL  ' + f)); console.log(`\n${fails.length} failure(s)`); process.exit(1); }
console.log(`ok [${via}] — tap-to-start then the picker (${booted.games.length} games), ${Object.keys(arcade).length} arcade games per-eye (${Object.entries(arcade).map(([k, v]) => k + ' ' + v.px + 'px').join(', ')}), Blocks clears rows, rocks/race/blocks never end a child's run and cap step-ups, the truck transforms and swims and holding the gas never crashes it (${truckFeel.courses.length} courses), wardens charge/ring/summon/leap, island 2 opens from island 1's light and the boat sails there, English fallback speech, carol ${carol.ctx === 'running' ? 'plays' : 'skipped (audio suspended)'}, flat panels have a way back; ${islands.length} islands winnable, bush/stone/bomb/arrow/torch/light all work, sitting clock survives replay, sailed to island ${sail.island}, ${booted.screens} stereo screens, ${sfxErrors.effects} sounds, ${menuDiff.checked} screens binocular, catch trials caught the masher (${trials.masher.fa} false alarms) and passed the honest run, child mode ${child.maxhp} hp, wizard ${kid.presented.length} rounds -> ${Math.round(kid.strong * 100)}%, ${sliders} tuning sliders, contrast delta touched ${diff} px, ${rec.rooms.length} room(s) logged`);
