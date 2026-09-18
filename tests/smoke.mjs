#!/usr/bin/env node
/* Headless playthrough. Optional: needs `npm i -D playwright`.
   Checks the things a static check cannot: that the page boots without errors,
   that both eye viewports actually differ in contrast, that the dev panel
   builds, and that a session log comes out with a room in it. */
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

const fails = [];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const pg = await browser.newPage({ viewport: { width: 900, height: 440 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
pg.on('console', (m) => { if (m.type() === 'error') fails.push('console: ' + m.text()); });

await pg.goto(page_url);
await pg.waitForTimeout(800);

const stamp = await pg.textContent('#buildStamp');
if (!stamp || !stamp.includes('Build')) fails.push('build stamp missing');

/* dev panel builds a control per numeric leaf */
await pg.click('#btnDevTitle');
await pg.waitForTimeout(300);
const sliders = await pg.evaluate(() => document.querySelectorAll('#devFields input[type=range]').length);
if (sliders < 40) fails.push(`dev panel only built ${sliders} sliders`);
await pg.click('#btnDevBack');

/* the two eyes must actually differ where a foe is drawn */
await pg.click('#btnStart');
await pg.click('#btnEnter');
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

/* session log */
for (const k of ['ArrowUp', 'ArrowRight', ' ']) {
  await pg.keyboard.down(k); await pg.waitForTimeout(200); await pg.keyboard.up(k);
}
const rec = await pg.evaluate(() => GH.record());
if (!rec.rooms || !rec.rooms.length) fails.push('session log has no rooms');
if (!rec.build) fails.push('session log has no build stamp');

await browser.close();
if (fails.length) { fails.forEach((f) => console.log('FAIL  ' + f)); console.log(`\n${fails.length} failure(s)`); process.exit(1); }
console.log(`ok — booted clean, ${sliders} tuning sliders, contrast delta touched ${diff} px, ${rec.rooms.length} room(s) logged`);
