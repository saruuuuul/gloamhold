#!/usr/bin/env node
/* How much luminance contrast does a given "contrast" setting really leave?
   The canvas blends gamma-encoded sRGB values, so a sprite drawn at blend
   alpha a keeps MORE than a of its luminance Michelson contrast against the
   floor. This prints that fraction (mean / min / max over the reference
   sprite colours) for each game's background, using the exact functions the
   app uses (lifted from src/20-core.js), on an ideal sRGB display.

   It is a model, not a measurement: a real phone is not an ideal sRGB
   display, and brightness, lenses and the room all change what reaches an
   eye. A photometer on the actual device is the only real number.

   node tools/contrast-table.mjs            markdown table
   node tools/contrast-table.mjs --json     the same numbers as JSON */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'src', '20-core.js'), 'utf8');
const from = core.indexOf('var CONTRAST_FLOOR'), to = core.indexOf('/* the alpha to draw at for a stronger-eye contrast');
if (from < 0 || to < 0) { console.error('contrast model not found in src/20-core.js'); process.exit(1); }
const M = new Function(core.slice(from, to) + '\nreturn { lumRatio, CONTRAST_REF, CONTRAST_FLOOR };')();

const FLOORS = [
  ['Islands (dungeon floor)', '#191e29'],
  ['Gator Truck (meadow sky)', '#16202c'],
  ['Jelly Blocks (level 1 jar)', '#141a26'],
  ['Space Rocks (field)', '#0e1320'],
  ['Racer (city road)', '#2c2f38'],
];
const ALPHAS = [1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1, 0.05];
const rows = FLOORS.map(([name, floor]) => ({
  name, floor,
  at: ALPHAS.map((a) => {
    const r = M.CONTRAST_REF.map((c) => M.lumRatio(a, c, floor));
    return { alpha: a, mean: +(r.reduce((x, y) => x + y, 0) / r.length).toFixed(2), min: +Math.min(...r).toFixed(2), max: +Math.max(...r).toFixed(2) };
  }),
}));

if (process.argv.includes('--json')) { console.log(JSON.stringify({ reference: M.CONTRAST_REF, rows }, null, 1)); process.exit(0); }
console.log('| Background | ' + ALPHAS.map((a) => `alpha ${a}`).join(' | ') + ' |');
console.log('|---|' + ALPHAS.map(() => '---').join('|') + '|');
for (const r of rows) console.log(`| ${r.name} \`${r.floor}\` | ` + r.at.map((x) => `${x.mean} (${x.min}–${x.max})`).join(' | ') + ' |');
console.log(`\nFraction of full luminance Michelson contrast kept: mean (min–max) over ${M.CONTRAST_REF.join(', ')}.`);
