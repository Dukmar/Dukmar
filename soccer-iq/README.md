# Pitch IQ

A 3D soccer-smarts trainer for a 10-year-old playing 7v7 in Halton. It teaches where to stand and what to do with and without the ball, then tests it with games. Built for home use on an older Mac or an iPhone.

## How to open it

| Device | How |
|---|---|
| iPhone or any browser | The private claude.ai artifact link in `HANDOFF.md`. Signed-in claude.ai accounts only, unless it's shared from the page's Share menu. |
| Mac, offline | Double-click `dist/pitch-iq.html`. Everything is inside that one file. Fonts fall back to system fonts when offline. |
| Mac, from the source | Open `index.html` in Safari or Chrome. |

Progress (XP, stars, badges) is saved in the browser on that device only.

## What's inside

- **Academy:** 8 units, 31 animated lessons. Each lesson is a set of steps: a caption, players and ball moving, arrows and zones on the field. Then two quick-check questions.
  1. Know Your Field (thirds, retreat lines, the 2-3-1, spreading out)
  2. Where Do I Stand? (keeper's ball, ball in the middle, attacking third, ball side and weak side)
  3. We Have the Ball (get open, triangles, scanning, pass/dribble/shoot, first touch, give-and-go, switching)
  4. They Have the Ball (goal-side, pressure-cover-balance, compactness, 1 v 1, recovery runs)
  5. Switch On! (winning and losing the ball)
  6. Restarts (goal kicks, Ontario kick-ins, short corners, kick-offs, free kicks)
  7. Keeper Smarts (angles, distribution, talking)
  8. Talk and Lead (the calls, leadership, fair play)
- **Games:** Spot On (drag yourself to the right spot, 15 puzzles), Spot the Mistake (12 scenes), Pass, Dribble or Shoot? (10 decisions), Keeper Hero (angle play, 10 shots), Quiz Blitz (57 questions).
- **Match Day:** a full match against a rival team: two halves, eight big moments drawn from all the games. On our chances a smart answer scores (and she does her goal celebration); when they attack, a smart answer stops them. Live scoreboard, half-time coach tip, win/draw/loss record. (Real U10 games in Ontario keep no score; this is the app's own game.)
- **Daily Challenge:** five moments, the same all day, with a day streak and bonus coins. Replays the same day are practice.
- **Locker Room:** coins (one per XP point, never lowering her level) buy kit designs (stripes, hoops, sash, halves, chevron, contrast sleeves), boot colours, balls (neon, rainbow, galaxy, gold, team colours), goal celebrations (champion arms, spin, airplane, knee slide) and stadiums (sunset, night under floodlights). She tries items on in 3D before buying.
- **Trophies:** level, XP, coins, lesson and Spot On stars, match record, goals, clean sheets, daily streak, personal bests for every game, and a trophy case of 18 badges.
- **Tactics Board:** drag any player or the ball, switch formations (2-3-1, 3-2-1, 2-1-2-1), and turn on Auto shape to watch both teams shift as the ball moves. Draw runs, and see the field through any player's eyes.
- **7v7 Rules:** the Halton / Ontario U10–U11 rules, with "Check" flags where clubs differ.
- **My Player:** name, jersey number and team colour (her number appears on "YOU" in every scene), a graphics setting for older devices.

You can rotate, zoom and pan the 3D field everywhere: drag to spin, pinch or scroll to zoom, two fingers (or shift-drag) to pan. On a Mac, the **arrow keys** (or WASD) move "YOU" in Spot On, the keeper in Keeper Hero, and the selected player or ball on the Tactics Board; **Enter** locks in or moves to the next one. "Up" always means away from the camera.

**Around the field:** fans line the far touchline and both ends and jump up to cheer after goals, saves and smart plays. A banner behind each goal says whose end it is ("OUR GOAL" in her team colour), the nets are tinted in each team's colour, keepers wear their team's shirt with bright gloves (real 7v7 keepers must wear a different colour; the app bends that so teams are easy to tell apart), and a ring in the team colour sits under whoever has the ball.

**Players talk to her** by name in speech bubbles: about 90 lines across the lessons, reactions in every game and the quiz, and chatter on the home screen. Edit them in `js/content/talk.js`.

## Research

`RESEARCH.md` holds the rules research, the coaching knowledge base, the survey of similar apps and the list of facts to confirm with her club.

## Changing things

- Lessons: `js/content/lessons.js` and `lessons2.js`. Coordinates are metres: x runs from our goal (-25) to theirs (+25), z from our left touchline (-17) to our right (+17).
- What the players say: `js/content/talk.js`.
- Questions: `js/content/quiz.js` (`c` is the index of the right answer; answers are shuffled on screen).
- Locker Room items and prices: `js/content/unlocks.js`. Match Day: `js/games/matchday.js`; the shared challenge engine: `js/games/moments.js`.
- Game scenarios: `js/content/scenarios.js`. Rules text: `js/content/rules.js`.
- After any change, rebuild the single files and run the test:

```
python3 soccer-iq/tools/build.py
NODE_PATH=$(npm root -g) node soccer-iq/tests/smoke.cjs soccer-iq/dist/pitch-iq.html
```

The test needs Playwright (`npm i -g playwright`). It walks every lesson step, every game and every screen at desktop, phone portrait and phone landscape sizes, and fails on any console error.

## Tech notes

- Plain JavaScript (ES2017, no modules, no build step to run it) so it works from a double-clicked file and in older Safari.
- Three.js r147, the last line that ships a non-module build and still supports WebGL 1 (older Macs). Vendored in `vendor/`; the hosted build loads the same version from jsDelivr.
- Mouse and touch events instead of pointer events, for Safari 12.
- All sound is synthesised in the browser; no audio files.
