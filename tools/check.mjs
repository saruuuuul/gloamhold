#!/usr/bin/env node
/* Gloamhold invariant check — no dependencies.
   Catches the failure modes this codebase actually has:
   scope-breaking source files, module syntax, el('id') typos, literals that
   should live in TUNING, and a bundle that does not parse. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

const names = readdirSync(SRC).sort();
const jsNames = names.filter((n) => n.endsWith('.js'));
const htmlNames = names.filter((n) => n.endsWith('.html'));
const read = (n) => readFileSync(join(SRC, n), 'utf8');

if (!jsNames.length || !htmlNames.length) fail('src/ is missing .js or .html parts');

/* 1 — no module syntax, no self-opened scope */
for (const n of jsNames) {
  const s = read(n);
  if (/^\s*(import|export)\s/m.test(s)) fail(`${n}: module syntax — sources are concatenated, not imported`);
  if (/^\s*\(function\s*\(\s*\)\s*\{/m.test(s)) fail(`${n}: opens its own IIFE — build.py supplies the wrapper`);
  if (/^\s*\}\)\(\);\s*$/m.test(s)) fail(`${n}: closes an IIFE — this cuts every later file out of scope`);
  if (/\brequire\s*\(/.test(s)) fail(`${n}: require() — there is no module loader`);
}

/* 2 — the concatenated bundle parses */
const bundle = jsNames.map(read).join('\n');
try {
  new Function(bundle);
} catch (e) {
  fail(`bundle does not parse: ${e.message}`);
}

/* 3 — every el('x') / getElementById('x') has a matching id in the markup */
const html = htmlNames.map(read).join('\n');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const referenced = new Set([
  ...bundle.matchAll(/\bel\(\s*'([^']+)'\s*\)/g),
  ...bundle.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g),
].map((m) => m[1]));
for (const id of referenced) {
  if (!ids.has(id)) fail(`JS references #${id}, which no panel markup defines`);
}

/* 4 — the dichoptic invariants, as far as static checking can reach */
/* drawing is spread across several files now (world, tools, owl, menus), so
   the linear-alpha rules are checked everywhere, not just in 50-render.js */
for (const n of jsNames) {
  const s2 = read(n);
  if (/globalCompositeOperation/.test(s2))
    fail(`${n}: globalCompositeOperation — alpha must stay linear or "contrast %" stops being true`);
  if (/shadowBlur|createLinearGradient|createRadialGradient/.test(s2))
    warn(`${n}: gradient or shadow — check it is not on a signal layer, where it breaks the alpha/contrast relationship`);
}

const core = read('20-core.js');
if (!/function alphaFor\s*\(/.test(core)) fail('alphaFor() is gone from 20-core.js');
/* eye visibility must not be decided anywhere that also sets alpha */
for (const n of jsNames) {
  if (n === '20-core.js') continue;                 // alphaFor lives here
  const s2 = read(n);
  if (/eye-alpha:\s*intentional/.test(s2)) continue;   // documented exception, see the marker in the file
  if (/cfg\.weakEye/.test(s2) && /globalAlpha/.test(s2))
    warn(`${n}: sets globalAlpha and branches on cfg.weakEye — route it through alphaFor(), or mark the file "eye-alpha: intentional — <reason>" if it genuinely must not`);
}
if (!/function lensZoom\s*\(/.test(core)) fail('lensZoom() is gone — the lens overfill compensation is missing');
if (/1\.0 \+ k1 \+ k2/.test(core) !== /1\s*\/\s*\(\s*1\s*\+\s*cfg\.k1\s*\+\s*cfg\.k2\s*\)/.test(core))
  fail('shader normalisation and lensZoom() disagree — the picture will silently zoom');

/* 5 — tuning coverage */
const tuning = read('30-tuning.js');
const leaves = [...tuning.matchAll(/(\w+)\s*:\s*-?\d+(\.\d+)?/g)].length;
if (leaves < 40) warn(`TUNING looks thin (${leaves} numeric fields) — new constants belong there, not inline`);

/* 6 — build output sanity, if it has been built */
const dist = join(ROOT, 'dist', 'index.html');
if (existsSync(dist)) {
  const d = readFileSync(dist, 'utf8');
  if (d.includes('__BUILD__')) fail('dist/index.html still contains __BUILD__ — the stamp was not substituted');
  if (!d.includes('manifest.webmanifest')) fail('dist/index.html has no manifest link — the PWA shell will not install');
  for (const bad of [...d.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)]) {
    if (!/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm\//.test(bad[1]))
      fail(`external script from a blocked host: ${bad[1]}`);
  }
}

for (const w of warns) console.log(`warn  ${w}`);
for (const f of fails) console.log(`FAIL  ${f}`);
console.log(
  fails.length
    ? `\n${fails.length} failure(s), ${warns.length} warning(s)`
    : `ok — ${jsNames.length} js parts, ${ids.size} ids, ${referenced.size} referenced, ${warns.length} warning(s)`
);
process.exit(fails.length ? 1 : 0);
