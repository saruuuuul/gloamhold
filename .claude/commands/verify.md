---
description: Build and run every check (invariants, wiring, headless playthrough)
---

Run, in order, and stop at the first failure:

```bash
python3 build.py
node tools/check.mjs
node tests/smoke.mjs
```

Report the build stamp, the check summary line and the smoke line. If `tools/check.mjs`
warns, do not silence the warning by weakening the rule — either fix the code or, if the
exception is genuine, add an `eye-alpha: intentional — <reason>` marker explaining why, as
`src/60-hud.js` does.

If the smoke test says the contrast delta touched very few pixels, treat that as a real
regression in the dichoptic path, not a flaky test: something is drawing signal sprites
outside the alpha/contrast relationship.
