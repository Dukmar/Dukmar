/* Pitch IQ — Academy units 5 to 8. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var S = PIQ.SHAPES;
  var F = PIQ.FIELD;
  var RL = F.L / 2 - F.retreat;
  var BLUE = 0x7cc8ff, YEL = 0xffe14d, ORANGE = 0xff7a1a, GOOD = 0x3ddc84, BAD = 0xff6b6b;

  PIQ.UNITS.push(
    // =====================================================================
    {
      id: 'switch', title: 'Switch On!', blurb: 'The moment the ball changes teams.',
      lessons: [
        {
          id: 'switch-1', title: 'We win it: look forward', sub: 'Attack before they get back',
          scene: {
            home: { GK: [-20, 0], LD: [-10, -7], RD: [-10, 7], CM: [-4, 1], LW: [0, -12], RW: [1, 11], ST: [7, -2] },
            away: { GK: [23, 0], D1: [6, -7], D2: [9, 3], M1: [-6, -5], M2: [-2, 2], M3: [-5, 9], F: [-13, 0] },
            ball: 'away:M2', you: 'CM', camera: { target: [0, 0], dist: 34, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'They have the ball and their whole team has moved up the field to attack.',
              dribble: { who: 'away:M2', to: [-2.5, 1.5] }, dur: 0.6 },
            { say: 'You step in and <b>win it!</b> Now, quick: the first thing to do is <b>look forward</b>.',
              move: { CM: [-2.9, 1.3] }, giveTo: 'CM', wait: 0.5, dur: 0.5, calls: { CM: 'MINE!' } },
            { say: 'Their players are still up the field, out of position. There\'s a big space behind them, and our striker is already running into it.',
              zones: [{ rect: [9, -10, 22, 6], color: GOOD, opacity: 0.16 }], move: { ST: [11, -4] }, arrows: [['ST', [15, -5], 'run']], dur: 1 },
            { say: 'Pass forward, fast, before they can get back. That\'s a <b>counter-attack</b>!',
              pass: { to: [15, -5], dur: 0.9 }, move: { ST: [15, -5], 'away:D1': [12, -7], 'away:D2': [13, -1] }, wait: 0.1, dur: 1 },
            { say: 'Goal! Rule of thumb: when we win the ball, look forward first. If there\'s no forward pass, keep it safe and set up our shape.',
              shoot: { from: 'ST', to: [25.6, 1.3], delay: 0.2 }, move: { ST: [18, -3.5] }, giveTo: 'ST', dur: 0.4 }
          ]
        },
        {
          id: 'switch-2', title: 'We lose it: press or get back', sub: 'The first few seconds matter',
          scene: {
            home: { GK: [-16, 0], LD: [-3, -7], RD: [-3, 7], CM: [8, 0], LW: [14, -10], RW: [12, 11], ST: [17, -1] },
            away: { GK: [23, 0], D1: [17, -5], D2: [18, 3], M1: [11, -5], M2: [9.5, 1.6], M3: [12, 8], F: [2, 1] },
            ball: 'CM', you: 'CM', camera: { target: [8, 0], dist: 32, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Oops: a defender pokes the ball away from you. It happens to everyone!',
              pass: { from: 'CM', to: 'away:M2', dur: 0.4 }, dur: 0.5 },
            { say: 'The nearest players <b>press straight away</b>, before their player can look up. This is the best moment to win it back.',
              move: { CM: [10.5, 0.8], RW: [11.5, 4], ST: [12, -0.5] }, arrows: [['CM', 'away:M2', 'run', 0, ORANGE]], calls: { CM: 'PRESS!' }, dur: 0.8 },
            { say: 'Everyone else <b>gets back into shape</b>, goal-side of the ball.',
              move: { LD: [-8, -6], RD: [-8, 6], LW: [3, -8], GK: [-20, 0] }, dur: 1.5 },
            { say: 'Pressed from three sides, she makes a mistake. We win it back!',
              pass: { from: 'away:M2', to: 'RW', dur: 0.5 }, wait: 0.2, calls: { RW: 'GOT IT!' } },
            { say: 'Rule of thumb: try to win it back in the <b>first few seconds</b>. If you can\'t, everyone gets back into shape. Coaches don\'t agree on the exact count, so think "right away", not a number.',
              think: { CM: 'Never give up on it!' } }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'restarts', title: 'Restarts', blurb: 'Goal kicks, kick-ins, corners, kick-offs and free kicks.',
      lessons: [
        {
          id: 'restarts-1', title: 'Goal kicks', sub: 'Play out from the back',
          scene: {
            home: { GK: [-22, 0], LD: [-16, -11], RD: [-16, 11], CM: [-11, 1], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] },
            away: { GK: [23, 0], D1: [6, -6], D2: [6, 6], M1: [-12, -8], M2: [-10, 3], M3: [-13, 7], F: [-15, 0] },
            ball: [-21, -1.5], camera: { target: [-12, 0], dist: 36, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'The ball went over our goal line, off their player. That\'s a <b>goal kick</b> for us. The keeper puts the ball down inside our box.',
              whistle: true, rings: { GK: YEL } },
            { say: 'In 7v7 the other team has to back off behind the <b>retreat line</b> before we take it.',
              move: { 'away:M1': [-6, -9], 'away:M2': [-3, 2], 'away:M3': [-6, 9], 'away:F': [-7, 0] },
              zones: [{ rect: [-RL - 0.35, -17, -RL + 0.35, 17], color: BLUE, opacity: 0.55 }], dur: 2 },
            { say: 'Defenders wide, centre mid showing in the middle. Now a short, safe pass to a defender.',
              pass: { from: 'GK', to: 'LD', delay: 0.3, dur: 1 }, arrows: [['GK', 'LD', 'pass']] },
            { say: 'Once the ball is touched, they can come forward again, so our defender takes a good first touch and looks up.',
              move: { 'away:M1': [-11, -9] }, dribble: { who: 'LD', to: [-13, -11] }, dur: 1.2 },
            { say: 'Your league may also have rules about whether the keeper can punt or drop-kick it. Ask your coach!',
              think: { GK: 'Short and safe is my plan.' } }
          ]
        },
        {
          id: 'restarts-2', title: 'Kick-ins, not throw-ins', sub: 'When it goes out the side',
          scene: {
            home: { GK: [-20, 0], LD: [-8, -10], RD: [-7, 9], CM: [-1, 4], LW: [6, -12], RW: [2, 14], ST: [11, 1] },
            away: { GK: [23, 0], D1: [12, -5], D2: [12, 5], M1: [3, -6], M2: [5, 2], M3: [4.5, 10], F: [-6, 2] },
            ball: [3, 17.6], camera: { target: [2, 9], dist: 28, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'The ball rolled out over the sideline off their player. In Ontario 7v7 there are <b>no throw-ins</b>. Instead you take a <b>kick-in</b>: a pass-in or a dribble-in.',
              whistle: true },
            { say: 'Put the ball still, on or just behind the sideline. The other team has to back off a few steps. Your league says exactly how far.',
              move: { RW: [3, 17.6] }, zones: [{ at: [3, 17], r: 3, color: YEL }], dur: 1 },
            { say: 'Be quick! A teammate gets open by moving away, then coming back toward the ball.',
              move: { CM: [4, 8.5] }, arrows: [['CM', [4, 8.5], 'run']], dur: 0.9 },
            { say: 'Pass it in. She\'s open and facing up the field!',
              pass: { from: 'RW', to: 'CM', delay: 0.2 }, move: { RW: [5, 14.5] }, wait: 0.6 },
            { say: 'Or, if there\'s space, you can <b>dribble it in</b> yourself. One more thing: you can\'t score straight from a kick-in.',
              dribble: { who: 'CM', to: [8, 7] }, think: { RW: 'Quick restarts catch them napping!' } }
          ]
        },
        {
          id: 'restarts-3', title: 'Corners', sub: 'Short corners and defending them',
          scene: {
            home: { GK: [-12, 0], LD: [0, -7], RD: [2, 6], CM: [16, 6], LW: [19, -4], RW: [24.6, 16.6], ST: [20.5, 1.5] },
            away: { GK: [24, 1], D1: [21, -1], D2: [21.5, 3], M1: [19, 7], M2: [17, -2], M3: [14, 3], F: [4, 0] },
            ball: [24.5, 16.5], camera: { target: [17, 7], dist: 26, theta: 0.15, phi: 0.92 }
          },
          beats: [
            { say: 'Their player knocked it over their own goal line. That\'s a <b>corner kick</b> for us, from the corner closest to where it went out.',
              whistle: true, rings: { RW: YEL } },
            { say: 'A high ball into the crowd usually needs a header. Canada Soccer\'s guidelines say heading isn\'t taught in training at your age, and coaches are asked to use <b>short corners</b> instead.',
              arrows: [[[24.5, 16.5], [21, 2], 'pass', -0.15, BAD]] },
            { say: 'Short corner: a teammate comes close, gets a pass along the ground, and now we can attack the box.',
              move: { CM: [20.5, 12] }, pass: { from: 'RW', to: 'CM', delay: 0.9 }, arrows: [['CM', [20.5, 12], 'run']], dur: 0.9 },
            { say: 'She dribbles at goal with the whole team ready. Lots of good choices now!',
              dribble: { who: 'CM', to: [20.5, 8] }, move: { RW: [22.5, 13] } },
            { say: 'When <b>they</b> have a corner: the keeper owns the space right in front of her goal, one player stands near the corner to stop a short corner, and everyone else guards the space in front of our goal.',
              cam: 'broadcast', notes: [[[-15, 0], 'Guard the space in front of goal']] }
          ]
        },
        {
          id: 'restarts-4', title: 'Kick-off', sub: 'Start the game with the ball',
          scene: { home: S.kickoff, away: S.kickoffAway, ball: [0, 0], camera: { target: [-4, 0], dist: 30, theta: 0.15, phi: 0.95 } },
          beats: [
            { say: 'Every half, and after every goal, the game restarts with a <b>kick-off</b> from the centre spot. Everyone starts in their own half.',
              whistle: true, zones: [{ rect: [-25, -17, 0, 17], color: BLUE, opacity: 0.12 }] },
            { say: 'You\'re allowed to score straight from a kick-off, but it almost never works. It\'s usually smarter to <b>keep the ball</b>.',
              arrows: [['ST', [25, 0], 'pass', 0, BAD]] },
            { say: 'Pass back to the centre mid. Now we have the ball and everyone can get into shape.',
              pass: { from: 'ST', to: 'CM' }, move: { LW: [3, -13], RW: [3, 13], ST: [8, 0], LD: [-10, -8], RD: [-10, 8] }, wait: 0.2, dur: 1.6 },
            { say: 'Then build the attack, just like you\'ve learned: triangles, width and depth.',
              links: [['CM', 'LW'], ['CM', 'RW'], ['CM', 'ST'], ['CM', 'LD'], ['CM', 'RD']] }
          ]
        },
        {
          id: 'restarts-5', title: 'Free kicks', sub: 'Be quick, or be organised',
          scene: {
            home: { GK: [-18, 0], LD: [-6, -8], RD: [-6, 8], CM: [7, 2], LW: [10, -11], RW: [11, 12], ST: [15, -1] },
            away: { GK: [23, 0], D1: [16, -4], D2: [16, 4], M1: [9, -5], M2: [9.5, 3], M3: [10, 8], F: [0, 0] },
            ball: [8, 1], camera: { target: [10, 0], dist: 28, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Our centre mid got fouled. That\'s a <b>free kick</b> for us, from where the foul happened.',
              whistle: true, rings: { CM: YEL } },
            { say: 'Smart move: if the other team isn\'t ready, take it <b>quickly</b>! Their players are still walking back.',
              pass: { from: 'CM', to: 'LW', delay: 0.4 }, move: { 'away:M1': [11, -7], 'away:D1': [15, -7] }, dur: 1.6 },
            { say: 'Our left wing has space to attack while they\'re still sorting themselves out.',
              dribble: { who: 'LW', to: [17, -10] }, dur: 1.4 },
            { say: 'When <b>they</b> get a free kick near our goal, a couple of us stand together as a <b>wall</b>, back the distance the ref says. Everyone else marks a player or guards the space.',
              cam: 'broadcast', think: { GK: 'I\'ll set the wall!' } }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'keeper', title: 'Keeper Smarts', blurb: 'Angles, starting attacks and talking.',
      lessons: [
        {
          id: 'keeper-1', title: 'Cut the angle', sub: 'Make the goal look small',
          scene: {
            home: { GK: [-24.6, 0], LD: [-17, -9], RD: [-16, 9], CM: [-8, 2] },
            away: { F: [-13, 6] },
            ball: 'away:F', you: 'GK', camera: { target: [-19, 2], dist: 22, theta: 0.5, phi: 0.95 }
          },
          beats: [
            { say: 'An attacker has the ball. Imagine two lines from the ball to each <b>goalpost</b>. That triangle is all the space she can shoot into.',
              arrows: [['away:F', [-25, -2.44], 'pass', 0, BAD], ['away:F', [-25, 2.44], 'pass', 0, BAD]] },
            { say: 'Step 1: stand on the line between the ball and the <b>middle of the goal</b>.',
              arrows: [['away:F', [-25, 0], 'run', 0, YEL], ['away:F', [-25, -2.44], 'pass', 0, BAD], ['away:F', [-25, 2.44], 'pass', 0, BAD]], move: { GK: [-24, 0.6] }, dur: 0.8 },
            { say: 'Step 2: come <b>a few steps off your line</b>. The closer you are to the ball, the smaller the goal looks to her. Don\'t go so far that she can chip it over you.',
              move: { GK: [-21.5, 1.8] }, arrows: [['away:F', [-25, -2.44], 'pass', 0, BAD], ['away:F', [-25, 2.44], 'pass', 0, BAD]], dur: 0.9 },
            { say: 'Step 3: feet <b>set</b> before the shot, knees bent, hands ready. The ball moves, you move with it.',
              dribble: { who: 'away:F', to: [-14, -4], dur: 1.4 }, move: { GK: [-21.7, -0.9] }, dur: 1.4 },
            { say: 'Save! Practise this in the <b>Keeper Hero</b> game.',
              shoot: { from: 'away:F', to: [-21.5, -0.9], lofted: 0.4, goal: false }, giveTo: 'GK', wait: 0.8, calls: { GK: 'MINE!' } }
          ]
        },
        {
          id: 'keeper-2', title: 'Start the attack', sub: 'Roll it wide after a save',
          scene: {
            home: { GK: [-22, 0.5], LD: [-16, -11], RD: [-16, 11], CM: [-11, 1], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] },
            away: { GK: [23, 0], D1: [8, -6], D2: [8, 6], M1: [-6, -9], M2: [-3, 2], M3: [-6, 9], F: [-7, 0] },
            ball: 'GK', you: 'GK', camera: { target: [-14, 0], dist: 32, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'You made the save! They\'re behind the retreat line. Before you throw, <b>look up</b>: who\'s open?',
              pov: 'GK', povLook: [-10, 0], scan: true, dur: 3.5 },
            { say: 'The middle is dangerous: if they steal it there, they\'re right in front of our goal. <b>Wide</b> is safer.',
              arrows: [['GK', 'CM', 'pass', 0, BAD], ['GK', 'LD', 'pass', 0, GOOD], ['GK', 'RD', 'pass', 0, GOOD]] },
            { say: 'Roll it along the ground. It\'s easier to control than a bouncing ball.',
              pass: { to: 'LD', delay: 0.3, dur: 1 } },
            { say: 'Now you\'re part of the attack. Step up to the edge of your box so your defenders can pass back to you if they get stuck.',
              move: { GK: [-16, 0] }, think: { GK: 'I\'m an option too!' } }
          ]
        },
        {
          id: 'keeper-3', title: 'Keeper talk', sub: 'You see everything, so say it',
          scene: {
            home: { GK: [-23, 0], LD: [-14, -6], RD: [-14, 6], CM: [-8, 0], LW: [-5, -10], RW: [-4, 10], ST: [3, 0] },
            away: { GK: [23, 0], D1: [8, -6], D2: [8, 6], M1: [-5, -5], M2: [-3, 3], M3: [-9, 9], F: [-12, 1] },
            ball: 'away:M2', you: 'GK', camera: { target: [-13, 0], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'The keeper can see the whole field, so she is the team\'s <b>organiser</b>. Short, loud words, with a name first.',
              think: { GK: 'Mia, mark number 9!' } },
            { say: 'They play a long ball toward our goal. If you\'re coming for it, shout <b>"KEEPER!"</b> so your defenders get out of the way.',
              pass: { from: 'away:M2', to: [-19, 1.5], lofted: 3, dur: 1.4 }, move: { GK: [-19.5, 1.2], 'away:F': [-16, 1] }, calls: { GK: 'KEEPER!' }, dur: 1.2 },
            { say: 'If a defender should clear it instead, tell her: <b>"AWAY!"</b> means kick it far and wide, out of danger.',
              calls: { GK: 'AWAY!' } },
            { say: 'And always be positive. A keeper who says "Great job, next one!" makes the whole team braver.',
              calls: { GK: 'GREAT JOB!' } }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'lead', title: 'Talk and Lead', blurb: 'The calls every player should know, and how to be a leader.',
      lessons: [
        {
          id: 'lead-1', title: 'The calls', sub: 'Man on, time, turn, switch and more',
          scene: {
            home: { GK: [-20, 0], LD: [-10, -9], RD: [-10, 8], CM: [-2, 0], LW: [6, -12], RW: [6, 12], ST: [12, 0] },
            away: { GK: [23, 0], D1: [14, -5], D2: [14, 5], M1: [4, -6], M2: [-6, -1], M3: [6, 7], F: [-13, 2] },
            ball: 'RD', camera: { target: [-3, 0], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Our centre mid is about to get the ball, and a defender is sneaking up behind her. Warn her: <b>"MAN ON!"</b> (some teams say "Player on!"). It means "someone\'s on you, protect it or pass it."',
              move: { 'away:M2': [-3.5, -1] }, pass: { to: 'CM', delay: 0.5 }, calls: { RD: 'MAN ON!' }, dur: 1 },
            { say: 'Now nobody is near her. Tell her <b>"TIME!"</b> It means "you have time, take a touch and look up."',
              move: { 'away:M2': [-8, -3] }, calls: { LD: 'TIME!' }, dur: 0.8 },
            { say: '<b>"TURN!"</b> means "there\'s room behind you, turn and face their goal."',
              calls: { ST: 'TURN!' }, dribble: { who: 'CM', to: [1, 0.5] } },
            { say: '<b>"SWITCH!"</b> means "the other side is open, move it across."',
              calls: { LW: 'SWITCH!' }, pass: { to: 'LW', delay: 0.5 } },
            { say: 'When they have the ball: <b>"DROP!"</b> means "get back toward our goal." <b>"PUSH UP!"</b> means "move up together." And the keeper\'s <b>"KEEPER!"</b> means "I\'ve got it."',
              calls: { CM: 'DROP!', LD: 'PUSH UP!' } },
            { say: 'Say a <b>name first</b>, so the right player listens: "Ava, man on!" Talk early, short and loud.',
              calls: { RD: 'AVA, TIME!' } }
          ]
        },
        {
          id: 'lead-2', title: 'Be a leader', sub: 'What great teammates do',
          scene: { home: S.midBall, away: S.midBallAway, ball: 'CM', you: 'CM', camera: 'broadcast' },
          beats: [
            { say: 'You don\'t need to be the captain to be a <b>leader</b>. Leaders talk, encourage, and work hard for the team.',
              think: { CM: 'Let\'s go, blue!' } },
            { say: 'When a teammate makes a mistake, say something kind: <b>"Unlucky! Next one!"</b> Mistakes are how everyone learns.',
              calls: { CM: 'UNLUCKY! NEXT ONE!' }, rings: { LW: BLUE } },
            { say: 'Watch your <b>body language</b>. Head up and jog back into position, even after a mistake. Your team copies what you do.',
              move: { CM: [-3, 0] }, dur: 1.4 },
            { say: '<b>Organise</b> your teammates: "Spread out!" "Get wide!" "Who\'s marking number 9?"',
              calls: { CM: 'GET WIDE!' }, move: { LW: [7, -14], RW: [7, 14] } },
            { say: 'Play fair. If someone is hurt, kick the ball out so they can get help, and the other team gives it back after. Accept the ref\'s call, and shake hands at the end.',
              think: { 'away:M2': 'Thanks for kicking it out!' } },
            { say: 'Leaders <b>keep going until the whistle</b>, help teammates up, and celebrate everyone\'s good play, not just goals.',
              calls: { CM: 'NICE PASS!' } }
          ]
        }
      ]
    }
  );
})();
