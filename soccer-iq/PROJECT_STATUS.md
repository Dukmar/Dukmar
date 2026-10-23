# Pitch IQ: project status

Last updated 2026-10-22 (night).

## State
Version 1 built and tested in headless Chromium (desktop, phone portrait, phone landscape). Not yet tried on a real older Mac or iPhone.

Live copy: private claude.ai artifact https://claude.ai/artifact/VL6RAii3sDkREvtD8g8fn6 (built from `dist/artifact.html`).

## What exists
- 31 animated lessons in 8 units, 57 quiz questions, 15 Spot On puzzles, 12 Spot the Mistake scenes, 10 decisions, Keeper Hero, Tactics Board, rules screen, player profile with XP, levels and 18 badges.
- Match Day, Daily Challenge with streaks, Locker Room (coins, 27 items, 3D try-on), Trophy Room.
- Arrow-key control, a cheering crowd, team-coloured ends and keepers, five hairstyles, and players who talk to her by name.
- `tools/build.py` makes `dist/pitch-iq.html` (offline, single file) and `dist/artifact.html` (hosted).
- `tests/smoke.cjs` walks everything and fails on console errors.

## Known gaps
- Rules verified against Ontario Soccer's April 2026 laws and the Peel Halton, Oakville and Burlington rule sheets. Club-specific differences left to confirm are in `RESEARCH.md` under "Still to confirm with her club".
- On Safari older than 14.1, flexbox `gap` is ignored, so some buttons will sit closer together. Works, looks a little tighter.
- Keeper Hero shots aim with a simple rule (the side the keeper leaves open, 80% of the time). No curve or chips except when the keeper comes out more than 7 m.
- No offline install as a home-screen app (service workers aren't allowed in an artifact). Safari "Add to Home Screen" from a regular web host would work.

## Ideas for version 2
- Family profiles (several players on one device). Discussed 2026-10-22, not chosen yet.
- Load the coach's real formation and positions, so the puzzles match her team.
- A parent view showing which lessons and puzzles she finds hard.
- More Spot On puzzles per position, especially keeper and centre mid.
- A 9v9 mode for when she moves up (U12 in Ontario, U11 in Burlington house league).
