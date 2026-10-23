// Pitch IQ smoke test: walks every screen, every lesson beat and every game in
// headless Chromium and fails on any console error.
// Run: NODE_PATH=$(npm root -g) node tests/smoke.cjs [path-to-html] [outdir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const html = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const out = path.resolve(process.argv[3] || path.join(__dirname, 'shots'));
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  async function newPage(w, h) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 600 });
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await p.goto('file://' + html);
    await sleep(1200);
    return p;
  }
  const shot = (p, name) => p.screenshot({ path: path.join(out, name + '.png') });
  const step = (name) => console.log('-', name, errors.length ? '(errors so far: ' + errors.length + ')' : '');

  const p = await newPage(1280, 800);
  await sleep(600);
  await shot(p, '01-welcome');
  await p.fill('#p-name', 'Maya');
  await p.fill('#p-num', '14');
  await p.click('.swatch[data-j="purple"]');
  await p.click('#p-save');
  await sleep(800);
  await p.evaluate(() => { PIQ.stageRef.cheer(); PIQ.chat(PIQ.stageRef, 'ambient', null, 5); });
  await sleep(700);
  await shot(p, '02-home');
  const fans = await p.evaluate(() => PIQ.stageRef.crowd.fans.length);
  console.log('- crowd: ' + fans + ' fans');
  if (fans < 30) errors.push('crowd missing');
  step('welcome + home');

  // every lesson, every beat, then the quick check
  const units = await p.evaluate(() => PIQ.UNITS.map((u) => u.lessons.length));
  let lessons = 0;
  for (let u = 0; u < units.length; u++) {
    for (let l = 0; l < units[u]; l++) {
      await p.evaluate(([u, l]) => PIQ.screens.lesson(u, l), [u, l]);
      const beats = await p.evaluate(([u, l]) => PIQ.UNITS[u].lessons[l].beats.length, [u, l]);
      for (let b = 0; b < beats; b++) {
        await sleep(b === 1 ? 900 : 250);
        if (u === 1 && l === 0 && b === 2) await shot(p, '03-lesson-shape');
        if (u === 2 && l === 2 && b === 1) await shot(p, '04-lesson-scan-pov');
        if (b > 0 && b < beats - 1 && b % 2 === 0) await p.click('#ls-prev');
        if (b > 0 && b < beats - 1 && b % 2 === 0) await p.click('#ls-next');
        await p.click('#ls-next');
      }
      for (let q = 0; q < 2; q++) {
        await sleep(200);
        if (await p.$('.answers .answer')) {
          await p.click('.answers .answer');
          await sleep(150);
          await p.click('#q-next');
        }
      }
      await sleep(200);
      if (!(await p.$('#f-again'))) throw new Error('lesson ' + u + '/' + l + ' did not reach the finish card');
      lessons++;
    }
  }
  await shot(p, '05-lesson-done');
  step('all ' + lessons + ' lessons');

  // Spot On
  await p.evaluate(() => PIQ.GAMES.spoton.start(PIQ.App, PIQ.screens.games));
  await sleep(700);
  // arrow keys move "YOU"
  const before = await p.evaluate(() => PIQ.stageRef.players[PIQ.stageRef.youId].pos.slice());
  await p.keyboard.down('ArrowUp'); await p.keyboard.down('ArrowRight');
  await sleep(900);
  await p.keyboard.up('ArrowUp'); await p.keyboard.up('ArrowRight');
  const after = await p.evaluate(() => PIQ.stageRef.players[PIQ.stageRef.youId].pos.slice());
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
  console.log('- arrow keys moved YOU ' + moved.toFixed(2) + ' m');
  if (moved < 0.3) errors.push('arrow keys did not move the player');
  await shot(p, '06-spoton');
  for (let i = 0; i < 5; i++) {
    // drag YOU to the best spot for some, leave others
    if (i % 2 === 0) await p.evaluate(() => { const st = PIQ.stageRef; const you = st.list.filter((x) => x.draggable)[0]; st.handlers.ground && st.handlers.ground([you.pos[0] + 2, you.pos[1]]); });
    await sleep(300);
    await p.click('#so-lock');
    await sleep(i === 0 ? 1800 : 400);
    if (i === 0) await shot(p, '07-spoton-reveal');
    await p.click('#so-next');
    await sleep(300);
  }
  if (!(await p.$('#so-again'))) throw new Error('spot on did not finish');
  step('spot on');

  // Spot the Mistake
  await p.evaluate(() => PIQ.GAMES.mistake.start(PIQ.App, PIQ.screens.games));
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    await p.evaluate((i) => {
      const st = PIQ.stageRef;
      const home = st.list.filter((x) => x.team === 'home');
      st.handlers.pick(home[i % home.length]);
    }, i);
    await sleep(i === 0 ? 3000 : 300);
    if (i === 0) await shot(p, '08-mistake');
    await p.click('#mk-next');
  }
  await sleep(300);
  if (!(await p.$('#mk-again'))) throw new Error('mistake did not finish');
  step('spot the mistake');

  // Pass, Dribble or Shoot
  await p.evaluate(() => PIQ.GAMES.decide.start(PIQ.App, PIQ.screens.games));
  for (let i = 0; i < 6; i++) {
    await sleep(600);
    if (i === 0) await shot(p, '09-decide');
    await p.click('.answers .answer:nth-child(' + ((i % 3) + 1) + ')');
    await sleep(i === 0 ? 1500 : 400);
    await p.click('#dc-next');
  }
  await sleep(300);
  if (!(await p.$('#dc-again'))) throw new Error('decide did not finish');
  step('pass dribble shoot');

  // Keeper Hero
  await p.evaluate(() => PIQ.GAMES.keeper.start(PIQ.App, PIQ.screens.games));
  await sleep(500);
  await p.click('#kp-go');
  for (let i = 0; i < 10; i++) {
    // steer toward the textbook spot on even shots
    await sleep(700);
    if (i % 2 === 0) await p.evaluate(() => { const st = PIQ.stageRef; st.handlers.groundDrag(PIQ.keeperIdeal(st.ball.pos), 'move'); });
    await p.waitForSelector('#kp-next', { timeout: 40000 });
    if (i === 0) await shot(p, '10-keeper');
    await p.click('#kp-next');
  }
  await sleep(300);
  if (!(await p.$('#kp-again'))) throw new Error('keeper did not finish');
  const saves = await p.evaluate(() => PIQ.profile().games.keeper);
  step('keeper hero (' + saves + ' saves)');

  // Quiz Blitz
  await p.evaluate(() => PIQ.GAMES.quizblitz.start(PIQ.App, PIQ.screens.home));
  for (let i = 0; i < 10; i++) {
    await sleep(300);
    if (i === 0) await shot(p, '11-quiz');
    await p.click('.answers .answer');
    await sleep(150);
    await p.click('#qb-next');
  }
  await sleep(300);
  if (!(await p.$('#qb-again'))) throw new Error('quiz did not finish');
  step('quiz blitz');

  // Tactics board
  await p.evaluate(() => PIQ.Board.start(PIQ.App, PIQ.screens.home));
  await sleep(600);
  await p.evaluate(() => {
    const st = PIQ.stageRef;
    PIQ.setBallPos(st.ball, 12, 9, 0);
    st.handlers.dragMove(st.ball);
    st.handlers.dragEnd(st.ball);
  });
  await sleep(1200);
  await shot(p, '12-board-auto');
  await p.click('#bd-have [data-h="0"]');
  await sleep(1200);
  await shot(p, '13-board-defend');
  await p.click('#bd-form [data-f="3-2-1"]');
  await p.click('#bd-draw');
  await p.evaluate(() => { const h = PIQ.stageRef.handlers.groundDrag; h([0, 0], 'start'); h([8, 5], 'move'); h([10, 6], 'end', true); });
  await p.evaluate(() => { const st = PIQ.stageRef; st.handlers.pick(st.players.ST); });
  await p.click('#bd-eyes');
  await sleep(800);
  await shot(p, '14-board-eyes');
  await p.click('#bd-opp');
  await p.click('#bd-reset');
  step('tactics board');

  // rules + profile + academy lists
  await p.evaluate(() => PIQ.screens.rules());
  await sleep(400);
  await shot(p, '15-rules');
  await p.click('[data-lesson="restarts-2"]');
  await sleep(800);
  await p.evaluate(() => PIQ.screens.profile());
  await sleep(300);
  await shot(p, '16-profile');
  await p.evaluate(() => PIQ.screens.academy());
  await sleep(300);
  const heights = await p.$$eval('.sheet .item', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  await p.evaluate(() => PIQ.screens.unit(2));
  await sleep(300);
  const heights2 = await p.$$eval('.sheet .item', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  console.log('- row heights academy', JSON.stringify(heights), 'unit', JSON.stringify(heights2));
  if (new Set(heights).size > 1 || new Set(heights2).size > 1) errors.push('list rows are not a uniform height');
  step('rules, profile, lists');

  // phone portrait
  const m = await newPage(390, 844);
  await sleep(500);
  await shot(m, '20-phone-home');
  await m.evaluate(() => PIQ.screens.lesson(1, 2));
  await sleep(1500);
  await shot(m, '21-phone-lesson');
  await m.evaluate(() => PIQ.GAMES.spoton.start(PIQ.App, PIQ.screens.games));
  await sleep(1200);
  await shot(m, '22-phone-spoton');
  await m.evaluate(() => PIQ.GAMES.keeper.start(PIQ.App, PIQ.screens.games));
  await sleep(800);
  await shot(m, '23-phone-keeper');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) errors.push('phone layout scrolls sideways');
  step('phone portrait');

  // phone landscape
  const ml = await newPage(844, 390);
  await ml.evaluate(() => PIQ.screens.lesson(2, 1));
  await sleep(1200);
  await shot(ml, '24-phone-landscape-lesson');
  step('phone landscape');

  await browser.close();
  if (errors.length) {
    console.log('\nFAILED with ' + errors.length + ' error(s):\n' + errors.slice(0, 20).join('\n'));
    process.exit(1);
  }
  console.log('\nPASS: no console errors. Screenshots in ' + out);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
