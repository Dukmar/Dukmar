# Handoff: Pitch IQ (soccer IQ app)

Session date 2026-10-22 (America/Toronto). Branch `claude/exciting-fermat-1x5nn9`. Everything new lives in `soccer-iq/`; the profile `README.md` at the repo root is untouched.

Play it now: https://claude.ai/artifact/VL6RAii3sDkREvtD8g8fn6 (private to your claude.ai account until you share it from the page's Share menu). Offline on the Mac: double-click `soccer-iq/dist/pitch-iq.html`.

## Done
- **The app** (first pass, afternoon): 3D engine on Three.js r147, 31 animated lessons in 8 units, 57 questions, five games (Spot On, Spot the Mistake, Pass Dribble or Shoot?, Keeper Hero, Quiz Blitz), Tactics Board, rules screen, profile with XP, levels and 12 badges. Details in `soccer-iq/README.md`.
- **Rules verified** (evening, after the network was opened): every rule the app teaches was checked against the primary documents, downloaded and read: Ontario Soccer's Adapted Match Formats Laws (updated April 30, 2026), Ontario Soccer's retreat line page, the Peel Halton 2026 rules, Oakville's U10/U11 and 2024 summer rule sheets, Burlington's 2025 recreation rules and Canada Soccer's heading guidelines. Changes that followed:
  - `js/content/rules.js`: all 16 rules cards rewritten from the sources. Settled: every 7v7 free kick is indirect except penalties, kick-in distance is 3 m, the retreat line also covers free kicks in your own third, and there's no separate goal area. Added a "Keeper's hands" card.
  - `js/content/lessons2.js`: kick-in, free kick and goal kick lessons now give exact distances and the drop-kick guidance.
  - `js/content/quiz.js`: three new questions (indirect free kicks, the 3 m kick-in distance, when opponents may cross the retreat line).
  - `js/world.js`: corner arcs at Ontario's 0.5 m.
  - `RESEARCH.md`: rules table rebuilt from the primary sources. The similar-apps table was rebuilt from each product's own store or vendor page; four rows needed platform or wording fixes. The scanning study (Jordet, 2020) was confirmed.
- **Your requests** (evening):
  - Arrow keys (or WASD) move "YOU" in Spot On, the keeper in Keeper Hero and the selected player or ball on the Tactics Board; Enter locks in or moves on (`js/stage.js`, games).
  - A crowd of 75 fans on the far sideline and behind both goals, mostly in her team colour, who jump and wave after goals, saves and good answers, sometimes shouting "GO PURPLE!" (`js/crowd.js`).
  - Clear team ends: "OUR GOAL" / "THEIR GOAL" banners in team colours, tinted nets, a team-coloured ring under whoever has the ball, and keepers in their team's shirt with bright lime gloves (`js/crowd.js`, `js/figures.js`). Real 7v7 laws make keepers wear a different colour; the app bends that on purpose.
  - Hair: five styles (high ponytail, ponytail with scrunchie, pigtails, long hair, bun), bigger and more visible (`js/figures.js`).
  - Speech bubbles now sit above the tallest hairstyle and stack instead of covering heads or each other (`js/stage.js`).
  - Players talk to her by name: 94 lesson lines plus 70 lines for the games, quiz, home screen and board (`js/content/talk.js`).
- **Verified:** the smoke test passes on `index.html` and the built `dist/pitch-iq.html`: all 31 lessons step by step, all five games, the board, rules, profile, phone portrait and landscape, zero console errors. It also checks that the arrow keys move "YOU" (3.25 m in the test) and that the crowd loads. All code parses as ES2017.
- **Not verified:** the published artifact page on claude.ai, and any real Mac or iPhone.

## Open
1. Which club and age group is she in? Burlington's house league moves U11 to 9v9 with throw-ins; everywhere else checked keeps U11 at 7v7.
2. Which formation does her coach use? The app teaches 2-3-1 first.
3. Two club differences the app flags but can't settle: penalty distance (Ontario 8 m, Oakville summer sheet 9 m) and whether keepers may drop-kick or score from a goal kick (Ontario and Oakville differ).
4. On an iPhone there are no arrow keys. Want an on-screen joystick, or is dragging enough?
5. Share the artifact with anyone else (Alison, the coach)? Only you can open it right now.
6. Want it on a normal web address (Netlify or GitHub Pages) so it can go on the iPhone home screen? That's a deploy, so it's yours to run.

## Needs the laptop
- Try it on the old Mac and the iPhone. If something looks off on the Mac, send the macOS and Safari versions.
- Any hosting deploy.

## Memory candidates
- Colin is building a 3D soccer IQ app for 10-year-old girls playing Halton 7v7, "for our consumption only", to run on "an old-school Mac or even an iPhone" (his words, 2026-10-22).
- Colin on soccer: "I know very little about soccer" (his words, 2026-10-22). Explain soccer terms plainly in anything written for him.
- Colin wants app characters to talk to the user: "I'd like more comments throughout the thing, with the players saying things to the person using it" (his words, 2026-10-22).
- Ontario 7v7 (U10–U11): kick-ins not throw-ins (opponents 3 m back), retreat line at the one-third line, no offside, all free kicks indirect except penalties, no scores (Ontario Soccer Adapted Match Formats Laws, April 30, 2026).
- Burlington Soccer Club house league plays U11 at 9v9 with throw-ins (BSC Recreation Rules 2025).
