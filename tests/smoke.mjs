#!/usr/bin/env node
/* Headless playthrough. Run `npm install` once; no browser download needed if
   Chrome or Edge is installed (see launch() below).
   Checks the things a static check cannot: that the page boots without errors,
   that both eye viewports actually differ in contrast, that a menu is drawn
   identically to both eyes, that the child wizard lands on a sane contrast,
   that the dev panel builds, and that a session log comes out with a room in it.

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
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const tried = [];
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      return { browser: await chromium.launch({ args, ...(channel ? { channel } : {}) }), via: channel || 'bundled chromium' };
    } catch (e) {
      tried.push(`${channel || 'bundled'}: ${String(e.message).split('\n')[0]}`);
    }
  }
  console.log('skip — no usable Chromium found:\n  ' + tried.join('\n  ') + '\n  fix with: npx playwright install chromium');
  process.exit(0);
}

const fails = [];
const { browser, via } = await launch();
const pg = await browser.newPage({ viewport: { width: 900, height: 440 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
pg.on('console', (m) => { if (m.type() === 'error') fails.push('console: ' + m.text()); });

await pg.goto(page_url);
await pg.waitForTimeout(800);

const stamp = await pg.textContent('#buildStamp');
if (!stamp || !stamp.includes('Build')) fails.push('build stamp missing');

/* boots into the stereo title, not a flat panel */
const booted = await pg.evaluate(() => ({ menu: GH.menu.id, screens: GH.screens().length }));
if (booted.menu !== 'title') fails.push(`booted into menu "${booted.menu}", expected "title"`);
if (booted.screens < 10) fails.push(`only ${booted.screens} stereo screens registered`);

/* every synthesised effect has to be callable without throwing */
const sfxErrors = await pg.evaluate(() => {
  const errs = [];
  const a = GH.audio();
  for (const n of Object.keys(GH.TUNING.audio)) void n;
  ['uiMove','uiOk','uiBack','swing','hitFoe','foeDie','hurt','shot','pickup','keyGet',
   'unlock','locked','roomClear','stepDown','stepUp','win','lose','bossWake','target',
   'star','oops','fanfare'].forEach((n) => { try { GH.sfx(n); } catch (e) { errs.push(n + ': ' + e.message); } });
  return { errs, effects: a.effects, failed: a.failed };
});
if (sfxErrors.errs.length) fails.push('sfx threw: ' + sfxErrors.errs.join(', '));
if (sfxErrors.effects < 20) fails.push(`only ${sfxErrors.effects} sound effects defined`);

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
console.log(`ok [${via}] — booted clean, ${booted.screens} stereo screens, ${sfxErrors.effects} sounds, ${menuDiff.checked} screens binocular, catch trials caught the masher (${trials.masher.fa} false alarms) and passed the honest run, child mode ${child.maxhp} hp, wizard ${kid.presented.length} rounds -> ${Math.round(kid.strong * 100)}%, ${sliders} tuning sliders, contrast delta touched ${diff} px, ${rec.rooms.length} room(s) logged`);
