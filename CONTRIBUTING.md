# Contributing to Gloamhold

Thank you for helping. Gloamhold is small, has no dependencies, and is played by young
children inside a stereo viewer, so a few rules matter more than usual.

## Before you change anything

- Read [`CLAUDE.md`](CLAUDE.md). Its numbered **invariants** are what make the per-eye arrangement
  mean anything (alpha is contrast, one place decides eye visibility, menus are identical in both
  eyes, child mode never makes struggling reduce the load, …). A change that breaks one can look
  fine on screen and still be wrong.
- **Keep the medical framing honest.** This is not a treatment. No efficacy claims anywhere — not
  in code, copy, issues or pull requests — and the *Not a medical device* blocks stay as they are.
- **Never ask a child for money.** Support links live only on the grown-up flat panel and in the
  README. `tools/check.mjs` fails a child-facing file that mentions donations.
- **No external scripts, assets or network calls.** Everything is drawn and synthesised at runtime;
  the build is one HTML file.

## Build and test

```bash
python3 build.py            # src/ -> dist/
node tools/check.mjs        # invariant and wiring checks; run after every edit
npm install                 # once; dev tooling only (Playwright)
node tests/smoke.mjs        # headless playthrough of every game and screen
```

`npm run verify` runs all three. The smoke test prints `ok [browser] — …`, a list of `FAIL` lines,
or `skip` if it found no browser — a skip is not a pass. Please run it before opening a pull
request, and say in the pull request what a session log would look like if your change works.

## Reporting bugs

Use the bug template and include the **build stamp** (Grown-up → *Not a medical device*, bottom
line). Please never post a child's name, photo or health details.

## Licence of contributions

Gloamhold is licensed under the **GNU Affero General Public License v3.0 or later**
([`LICENSE`](LICENSE)). By submitting a contribution you agree that:

1. it is your own work (or you have the right to submit it), and it is licensed under
   AGPL-3.0-or-later; and
2. the maintainer may also license your contribution under other terms, so that the project can
   offer separate licences (for example to an organisation that cannot accept the AGPL) and use
   the proceeds to keep it going. Everything stays available under the AGPL regardless.

If you do not agree to point 2, say so in your pull request before it is merged.
