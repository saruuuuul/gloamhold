#!/usr/bin/env python3
"""Gloamhold build: concatenate src/ into one self-contained page.

Two outputs:
  dist/index.html          standalone page for GitHub Pages / saving to a phone
  dist/artifact-body.html  same content minus the html/head/body skeleton,
                           for publishing through Claude's Artifact tool

No bundler, no dependencies. Sources are plain files concatenated in
filename order, so `20-core.js` runs before `40-entities.js`.
"""
import re, shutil, subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, PUB, DIST = ROOT / "src", ROOT / "public", ROOT / "dist"

VERSION = (ROOT / "VERSION").read_text().strip()

def git_sha():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
            stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return "local"

BUILD = "%s+%s %s" % (VERSION, git_sha(),
                      datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))

def read(name):
    return (SRC / name).read_text(encoding="utf-8")

html_parts = sorted(p.name for p in SRC.glob("*.html"))
js_parts   = sorted(p.name for p in SRC.glob("*.js"))
if not html_parts or not js_parts:
    raise SystemExit("src/ is missing .html or .js parts")

head_and_body = "\n".join(read(n) for n in html_parts)
script        = "\n".join(read(n) for n in js_parts)
NOTICE = ("/*! Gloamhold %s - dichoptic stereo games. Copyright (C) 2026 Saruul.\n"
          " * Free software: GNU Affero General Public License v3.0 or later (SPDX: AGPL-3.0-or-later).\n"
          " * Source: https://github.com/saruuuuul/gloamhold - not a medical device. */\n" % VERSION)
body = (head_and_body + "\n<script>\n" + NOTICE + "(function(){\n\"use strict\";\n"
        + script + "\n})();\n</script>\n")
body = body.replace("__BUILD__", BUILD)

# split the concatenated head material from the first markup element
head_end = body.index('<div id="stage">')
head_src, rest = body[:head_end], body[head_end:]

SW_REG = """
<script>
/* Service worker: only meaningful on a real origin over https (or localhost).
   Network-first for the page so a deploy is picked up on the next launch. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function(){});
  });
}
</script>
"""

# Link previews (chat apps, social sites, search). og:image must be an absolute URL.
# Keep the wording to what the thing is: no claim that it treats or improves anything.
SITE = "https://saruuuuul.github.io/gloamhold/"
DESC = ("Five side-by-side stereo games for a phone in a Cardboard viewer, with separate contrast "
        "for each eye. Free software (AGPL-3.0). A hobby project, not a medical device.")
META = "\n".join([
    '<meta name="description" content="%s">' % DESC,
    '<link rel="canonical" href="%s">' % SITE,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Gloamhold">',
    '<meta property="og:title" content="Gloamhold: stereo games with per-eye contrast">',
    '<meta property="og:description" content="%s">' % DESC,
    '<meta property="og:url" content="%s">' % SITE,
    '<meta property="og:image" content="%sog.png">' % SITE,
    '<meta property="og:image:width" content="1280">',
    '<meta property="og:image:height" content="640">',
    '<meta property="og:image:alt" content="Two halves of a space shooter: a rock king faint on the left, full strength on the right">',
    '<meta name="twitter:card" content="summary_large_image">',
])

STANDALONE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#07090d">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
{meta}
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" href="./icon-192.png">
<link rel="apple-touch-icon" href="./icon-192.png">
<style>
:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);color-scheme:dark}
body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}
</style>
{head}
</head>
<body>
{rest}
{swreg}
</body>
</html>
"""

DIST.mkdir(exist_ok=True)
(DIST / "index.html").write_text(
    STANDALONE.replace("{meta}", META).replace("{head}", head_src).replace("{rest}", rest)
              .replace("{swreg}", SW_REG),
    encoding="utf-8")
(DIST / "artifact-body.html").write_text(body, encoding="utf-8")

for f in PUB.iterdir():
    if f.is_file():
        text = f.suffix in (".webmanifest", ".js", ".json")
        if text:
            (DIST / f.name).write_text(
                f.read_text(encoding="utf-8").replace("__BUILD__", BUILD), encoding="utf-8")
        else:
            shutil.copy2(f, DIST / f.name)

print("build", BUILD)
for f in sorted(DIST.iterdir()):
    print("  %-24s %8d bytes" % (f.name, f.stat().st_size))
