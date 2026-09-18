---
description: Verify, commit and push to main (which deploys to GitHub Pages)
---

1. `python3 build.py && node tools/check.mjs && node tests/smoke.mjs` — all must pass.
2. `git status` and `git diff` — show me what is about to go out.
3. Bump `VERSION` if the change is behavioural rather than cosmetic.
4. Commit with a message that says what changed *for the player or the training*, not which
   functions moved.
5. Push to `main` only after I confirm. The push deploys; there is no staging environment.

After pushing, tell me the new build stamp so I can check the phone is running it — the
service worker is network-first, so it lands on the next launch, not instantly.
