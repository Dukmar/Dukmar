# Handoff: Pitch IQ (soccer IQ app)

Session date 2026-10-22 (America/Toronto). Branch `claude/exciting-fermat-1x5nn9`. Everything new lives in `soccer-iq/`; the profile `README.md` at the repo root is untouched.

Play it now: https://claude.ai/artifact/VL6RAii3sDkREvtD8g8fn6 (private to your claude.ai account until you share it from the page's Share menu).

## Done
- `soccer-iq/RESEARCH.md`: Halton / Ontario 7v7 rules table with sources, the coaching knowledge base the lessons are built on, a survey of similar apps (8 confirmed in store listings) with a gap analysis, and five facts to confirm with her club.
- `soccer-iq/index.html`, `css/app.css`: the app shell. Full-screen 3D field with a chalkboard-green panel and cone-orange buttons.
- `soccer-iq/js/core.js`, `world.js`, `figures.js`, `stage.js`: 3D engine on Three.js r147. A 50 × 34 m pitch with retreat lines, goals, park surroundings; low-poly players with ponytails, numbered shirts, run cycles; drag to orbit, pinch to zoom, two-finger pan; draggable players and ball; arrows, zones, floating labels; first-person "her eyes" camera.
- `soccer-iq/js/content/*.js`: 31 lessons in 8 units, 54 questions, 15 Spot On puzzles, 12 Spot the Mistake scenes, 10 decisions, 15 rules cards.
- `soccer-iq/js/player.js`: plays lessons step by step with back, replay and slow-motion.
- `soccer-iq/js/games/*.js`, `board.js`: Spot On, Spot the Mistake, Pass Dribble or Shoot?, Keeper Hero, Quiz Blitz, and the Tactics Board with auto-shape for both teams.
- `soccer-iq/js/app.js`: home, Academy, games list, rules, profile (name, number, team colour), XP and levels (Rookie to Legend), 12 badges, progress saved on the device.
- `soccer-iq/tools/build.py`: builds `dist/pitch-iq.html` (offline single file, 842 KB) and `dist/artifact.html` (hosted, 248 KB).
- `soccer-iq/tests/smoke.cjs`: headless Chromium walk-through.
- **Verified:** the smoke test passes on both `index.html` and `dist/pitch-iq.html`: every step of all 31 lessons with their quick checks, all five games to the end, the board, rules, profile, phone portrait (390 × 844) and phone landscape (844 × 390), zero console errors, no sideways scroll, list rows a uniform 63 px. All JavaScript parses as ES2017. Keeper Hero maths checked separately: standing within half a metre of the textbook spot saves about 9 shots in 10, hugging the goal line saves about 2 in 10.
- **Not verified:** the published artifact itself (no preview tool in this session), and any real device. Headless Chromium uses software rendering, so frame rate on a real old Mac is unknown.

## Open
1. Which club and age group is she in? Burlington Soccer Club's house league moves U11 to 9v9; the app assumes 7v7.
2. Which formation does her coach use? The app teaches 2-3-1 first. If it's a 3-2-1, I can rebuild the puzzles around it.
3. Five rules to confirm on her club's current rule sheet (all flagged "Check" in the app): kick-in distance (3 m or 2 yd), whether free kicks are all indirect, whether the keeper may punt or drop-kick, the U11 format, and whether her league uses dribble-ins at all.
4. Do you want her name, number and team colour preset, or does she set them on first launch (current behaviour)?
5. Share the artifact with anyone else (Alison, the coach)? Only you can open it right now.
6. Want it on a normal web address too (Netlify or GitHub Pages)? That would also allow "Add to Home Screen" on the iPhone. It's a deploy, so it's yours to run.

## Needs the laptop
- Open the sources in `RESEARCH.md` and confirm them. This cloud environment's network policy refused every rules page and app-store page (ontariosoccer.net, canadasoccer.com, oakvillesoccer.ca, burlingtonsoccer.com, apps.apple.com and others), so all research came from search-result summaries. To let a future cloud session read them: environment menu in the session title bar → Edit → Network access, then widen the level or add those domains (https://code.claude.com/docs/en/cloud-environments#network-access).
- Try it on the old Mac (double-click `soccer-iq/dist/pitch-iq.html`) and on the iPhone (artifact link). Tell me the Mac's macOS and Safari versions if anything looks off; on Safari older than 14.1 some buttons sit closer together.
- Any hosting deploy (Netlify / GitHub Pages).

## Memory candidates
- Colin is building a 3D soccer IQ app for 10-year-old girls playing Halton 7v7, "for our consumption only", to run on "an old-school Mac or even an iPhone" (his words, 2026-10-22).
- Colin on soccer: "I know very little about soccer" (his words, 2026-10-22). Explain soccer terms plainly in anything written for him.
- Ontario 7v7 (U10–U11) uses kick-ins (pass-in or dribble-in), not throw-ins, a one-third-line retreat line, no offside and no scores (multiple Ontario and club rule sheets via search, 2026-10-22; pages not opened).
- Burlington Soccer Club house league plays U11 at 9v9, unlike the Ontario U10–U11 7v7 default (BSC Recreation Rules 2025 via search, 2026-10-22).
- Cloud sessions in this environment: WebFetch and curl are blocked for most external sites; only WebSearch works, so research there is search-summary only (proxy log, 2026-10-22).
