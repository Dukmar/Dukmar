# Pitch IQ: project status

Last updated 2026-10-22.

## State
Version 1 built and tested in headless Chromium (desktop, phone portrait, phone landscape). Not yet tried on a real older Mac or iPhone.

Live copy: private claude.ai artifact https://claude.ai/artifact/VL6RAii3sDkREvtD8g8fn6 (built from `dist/artifact.html`).

## What exists
- 31 animated lessons in 8 units, 54 quiz questions, 15 Spot On puzzles, 12 Spot the Mistake scenes, 10 decisions, Keeper Hero, Tactics Board, rules screen, player profile with XP, levels and 12 badges.
- `tools/build.py` makes `dist/pitch-iq.html` (offline, single file) and `dist/artifact.html` (hosted).
- `tests/smoke.cjs` walks everything and fails on console errors.

## Known gaps
- Rules and coaching facts come from search results; the pages themselves were blocked in the cloud session. The list to confirm is in `RESEARCH.md` under "Check before you trust it".
- On Safari older than 14.1, flexbox `gap` is ignored, so some buttons will sit closer together. Works, looks a little tighter.
- Keeper Hero shots aim with a simple rule (the side the keeper leaves open, 80% of the time). No curve or chips except when the keeper comes out more than 7 m.
- No offline install as a home-screen app (service workers aren't allowed in an artifact). Safari "Add to Home Screen" from a regular web host would work.

## Ideas for version 2
- Load the coach's real formation and positions, so the puzzles match her team.
- A parent view showing which lessons and puzzles she finds hard.
- More Spot On puzzles per position, especially keeper and centre mid.
- A 9v9 mode for when she moves up (U12 in Ontario, U11 in Burlington house league).
