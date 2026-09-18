---
description: Add a room to the dungeon
---

Rooms live in `ROOMS` in `src/20-core.js`, keyed `"col,row"` on a grid with row 0 at the top.

To add one:

1. Pick a free key. Add `{ name, doors, pat, foes, lock?, drop?, dropNow? }`.
2. `doors` is a subset of the letters `nsew`. **Both sides must agree** — a room with `n`
   needs the room above it to have `s`, or the door leads into a wall.
3. `pat` is a key of `PATTERNS`. Add a new one there if none fit; it receives the tile grid
   and writes `1` for wall. Keep the doorway columns (`CC-1..CC+1`) and rows (`CR-1..CR+1`)
   clear or the room is unenterable.
4. `foes` entries are `[type, tileX, tileY]`. Types come from `TUNING`: grub, bat, sentry, boss.
5. `lock: {n:'small'|'boss'}` makes that door need a key. `drop` spawns an item on clear —
   `heart`, `vessel`, `smallkey`, `bosskey`. `dropNow: true` places it without clearing.

Then walk the required path yourself and confirm it is still completable:
start `1,2` → warden's key → `1,1` → boss `1,0`. Say which rooms the player must clear and
which are optional. Finish with `/verify`.
