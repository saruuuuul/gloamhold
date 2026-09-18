---
description: Turn a pasted session log into concrete TUNING changes
---

I will paste a session log JSON (from the pause screen's *Copy session log*).

Read it and answer these, with the numbers behind each:

- **Did the staircase move?** Compare `outcome.contrastStart`, `contrastBest`, `contrastEnd`
  and `stepsDown` vs `stepsUp`. Flat near the top means the dungeon was too hard to ever
  earn a clean room — the fix is easier combat, not a lower contrast.
- **Where did the hits come from?** `rooms[]` has per-room `hitsTaken` and `clean`. If one
  enemy type dominates, name it.
- **Was any room a wall?** Long `clearedAt - inAt` with `clean: false`.
- **Did the eyes both stay in?** `noniusChecks` answer 3 is suppression, answer 2 means the
  stronger eye was below its threshold and out of the task entirely.

Then propose specific `TUNING` edits as a diff, each with the reason and the number it came
from. Apply only the ones I pick, then `/verify`.

Do not propose changes that make the *therapy* easier to satisfy without making the *task*
better — lowering `stepDownFactor` so the contrast falls faster is not progress if the hits
per room did not change.
