/* Pitch IQ — the Academy: units of short animated lessons.
   Facts follow RESEARCH.md. Numbers given to kids are phrased as rules of thumb.
   Pitch: x -25 (our goal) to +25 (their goal); z -17 (our left) to +17 (our right). */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var S = PIQ.SHAPES;
  var RL = PIQ.FIELD.L / 2 - PIQ.FIELD.retreat; // retreat line distance from halfway (8.33)
  var BLUE = 0x7cc8ff, YEL = 0xffe14d, ORANGE = 0xff7a1a, GOOD = 0x3ddc84, BAD = 0xff6b6b;

  PIQ.UNITS = [
    // =====================================================================
    {
      id: 'field', title: 'Know Your Field', blurb: 'The 7v7 field, your team and why spreading out matters.',
      lessons: [
        {
          id: 'field-1', title: 'The 7v7 field', sub: 'Thirds, boxes and retreat lines',
          scene: { home: S.kickoff, away: S.kickoffAway, ball: [0, 0], camera: 'broadcast' },
          beats: [
            { say: 'Your game is <b>7 v 7</b>: six players plus a keeper on each team. In Pitch IQ we wear <b>blue</b> and we always attack to the <b>right</b>.',
              arrows: [[[-6, -15], [8, -15], 'run']], tags: { GK: 'Our keeper', 'away:GK': 'Their keeper' } },
            { say: 'The field splits into <b>three thirds</b>. Our <b>defending third</b> is by our goal, then the <b>middle third</b>, then the <b>attacking third</b> by their goal.',
              zones: [{ rect: [-25, -17, -RL, 17], color: BLUE, opacity: 0.18 }, { rect: [-RL, -17, RL, 17], color: YEL, opacity: 0.14 }, { rect: [RL, -17, 25, 17], color: ORANGE, opacity: 0.18 }],
              notes: [[[-17, 0], 'Defending third'], [[0, -9], 'Middle third'], [[17, 0], 'Attacking third']], cam: 'top' },
            { say: 'Be careful in your defending third, where a mistake can cost a goal. Be brave in the attacking third, where a risk can score one.',
              zones: [{ rect: [-25, -17, -RL, 17], color: BLUE, opacity: 0.18 }, { rect: [RL, -17, 25, 17], color: ORANGE, opacity: 0.18 }],
              notes: [[[-17, 0], 'Be careful'], [[17, 0], 'Be brave']] },
            { say: 'See the <b>dashed lines</b>? Those are <b>retreat lines</b>. When our keeper has the ball or we take a goal kick, the other team has to back off behind that line. It gives us room to pass out from the back.',
              zones: [{ rect: [-RL - 0.35, -17, -RL + 0.35, 17], color: BLUE, opacity: 0.5 }], notes: [[[-RL, -12], 'Retreat line']], cam: 'broadcast' },
            { say: 'The big box in front of each goal is the <b>penalty area</b>. The keeper can only use her hands inside her own box.',
              zones: [{ rect: [-25, -11, -14, 11], color: YEL, opacity: 0.2 }], rings: { GK: YEL }, cam: { target: [-17, 0], dist: 30, theta: 0.3, phi: 0.95 } },
            { say: 'Good news: 7v7 has <b>no offside</b>, so you can stand anywhere. But standing in a <b>smart</b> spot still wins games. That\'s what Pitch IQ is all about!',
              cam: 'broadcast', think: { ST: 'No offside? Cool!' } }
          ]
        },
        {
          id: 'field-2', title: 'Meet your team', sub: 'The 2-3-1 and what each player does',
          scene: { home: S.midBall, ball: 'CM', camera: 'broadcast' },
          beats: [
            { say: 'Lots of 7v7 teams play a <b>2-3-1</b>: the keeper, then <b>2</b> defenders, <b>3</b> across the middle, and <b>1</b> striker. Count from the back and skip the keeper.',
              tags: { GK: 'Keeper', LD: 'Left back', RD: 'Right back', LW: 'Left wing', CM: 'Centre mid', RW: 'Right wing', ST: 'Striker' } },
            { say: '<b>Keeper</b>: stops shots, talks to her team and starts our attacks with a roll or a throw.',
              rings: { GK: YEL }, think: { GK: 'I can see the whole field from here!' }, cam: { target: [-14, 0], dist: 28, theta: 0.2, phi: 0.95 } },
            { say: '<b>Defenders</b> (left back and right back) defend first. When we have the ball they spread wide to give an easy pass.',
              rings: { LD: YEL, RD: YEL }, cam: { target: [-9, 0], dist: 32, theta: 0, phi: 0.95 } },
            { say: '<b>Wingers</b> keep our team wide, one on each side. They attack down the sides, then run back to help defend.',
              rings: { LW: YEL, RW: YEL }, arrows: [['LW', [16, -13], 'run'], ['RW', [16, 13], 'run']], cam: { target: [7, 0], dist: 34, theta: 0, phi: 0.95 } },
            { say: '<b>Centre mid</b> is the link. She stays close to the ball to help, in attack and in defence.',
              rings: { CM: YEL }, think: { CM: 'Always an option!' }, cam: { target: [0, 0], dist: 28, theta: 0, phi: 0.95 } },
            { say: '<b>Striker</b> is our highest player. She stretches the other team and is first to chances in front of their goal.',
              rings: { ST: YEL }, cam: { target: [12, 0], dist: 28, theta: 0, phi: 0.95 } },
            { say: 'Your coach might use a different shape, like a <b>3-2-1</b> with three at the back. Every shape has the same idea: spread out and help each other. Good coaches also let everyone try different positions.',
              links: [['GK', 'LD'], ['GK', 'RD'], ['LD', 'CM'], ['RD', 'CM'], ['LD', 'LW'], ['RD', 'RW'], ['CM', 'ST'], ['LW', 'ST'], ['RW', 'ST']], cam: 'broadcast' }
          ]
        },
        {
          id: 'field-3', title: 'Spread out!', sub: 'Width, depth and the beehive',
          scene: { home: S.midBall, away: S.midBallAway, ball: 'CM', camera: 'broadcast' },
          beats: [
            { say: 'When everyone runs to the ball it\'s called <b>bunching</b>, or the <b>beehive</b>. Watch...',
              move: { LW: [2.5, -2.5], RW: [2.5, 2.5], ST: [3.5, 0.5], LD: [-2, -2.5], RD: [-2, 2.5], 'away:M1': [3, -1.5], 'away:M3': [3.5, 2.8], 'away:F': [-1.5, 1] }, dur: 1.8 },
            { say: 'Bunched up, there\'s nobody to pass to, and one big kick clears everyone. Not good!',
              think: { CM: 'Help! Nowhere to pass!' }, cam: { target: [1, 0], dist: 20, theta: 0.4, phi: 0.9 } },
            { say: '<b>Width</b> means using the whole field, side to side. The wingers go out near the sidelines and the defenders split apart.',
              move: { LW: [7, -13], RW: [7, 13], LD: [-9, -8], RD: [-9, 8], 'away:M1': [6, -8], 'away:M3': [6, 8], 'away:F': [-4, -2] },
              arrows: [[[2.5, -2.5], [7, -13], 'run'], [[2.5, 2.5], [7, 13], 'run']], cam: 'broadcast', dur: 1.6 },
            { say: '<b>Depth</b> means someone ahead of the ball and someone behind it. The striker stays high, the defenders stay back.',
              move: { ST: [13, 0] }, links: [['ST', 'CM'], ['CM', 'LD'], ['CM', 'RD']], tags: { ST: 'Ahead', LD: 'Behind', RD: 'Behind' } },
            { say: 'Spread out, our team looks like a big kite with passing lanes everywhere. Rule of thumb: stay <b>a good pass away</b> from your teammates, not right on top of them.',
              links: [['GK', 'LD'], ['GK', 'RD'], ['LD', 'CM'], ['RD', 'CM'], ['LD', 'LW'], ['RD', 'RW'], ['CM', 'ST'], ['LW', 'ST'], ['RW', 'ST'], ['CM', 'LW'], ['CM', 'RW']],
              pass: { to: 'RW', delay: 1.2 } }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'shape', title: 'Where Do I Stand?', blurb: 'Our shape when the ball is at the back, in the middle and up front.',
      lessons: [
        {
          id: 'shape-1', title: 'Keeper has the ball', sub: 'Split wide and use the retreat line',
          scene: {
            home: { GK: [-23, 0], LD: [-19, -4], RD: [-19, 4], CM: [-14, 0], LW: [-10, -11], RW: [-10, 11], ST: [-4, 0] },
            away: { GK: [23, 0], D1: [4, -6], D2: [4, 6], M1: [-14, -7], M2: [-13, 3], M3: [-15, 8], F: [-17, -1] },
            ball: 'GK', camera: { target: [-12, 0], dist: 38, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Our keeper just caught the ball. Now the other team has to <b>retreat</b> behind the dashed line.',
              whistle: true, move: { 'away:M1': [-5, -9], 'away:M2': [-3, 2], 'away:M3': [-5, 9], 'away:F': [-7, 0], 'away:D1': [8, -6], 'away:D2': [8, 6] },
              zones: [{ rect: [-RL - 0.35, -17, -RL + 0.35, 17], color: BLUE, opacity: 0.55 }], dur: 2 },
            { say: 'Our <b>defenders split wide</b>, near the edge of the box and close to the sidelines. That stretches the other team apart.',
              move: { LD: [-16, -11], RD: [-16, 11] }, arrows: [['LD', [-16, -11], 'run'], ['RD', [-16, 11], 'run']] },
            { say: 'Our <b>centre mid</b> drops into the middle to show for the ball. The <b>wingers</b> stay wide and the <b>striker</b> stays high to push their defenders back.',
              move: { CM: [-11, 1], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] }, cam: 'broadcast' },
            { say: 'Now the keeper has easy choices. She rolls it to a defender out wide, away from danger in the middle.',
              pass: { to: 'RD', delay: 0.3, dur: 1 }, arrows: [['GK', 'RD', 'pass']] },
            { say: 'Once we touch it, they can come forward. A defender presses, so our right back looks up the line and passes to her winger.',
              move: { 'away:M3': [-12, 9.5] }, pass: { to: 'RW', delay: 1.1, dur: 0.9 }, arrows: [['RD', 'RW', 'pass']], dur: 1.2 }
          ]
        },
        {
          id: 'shape-2', title: 'Ball in the middle', sub: 'Move up together like a rubber band',
          scene: {
            home: { GK: [-22, 0], LD: [-16, -10], RD: [-16, 10], CM: [-8, 0], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] },
            away: S.midBallAway, ball: 'CM', camera: 'broadcast'
          },
          beats: [
            { say: 'When the ball moves up the field, the whole team moves up with it, as if we were tied together with a <b>rubber band</b>.',
              dribble: { who: 'CM', to: [0, 0] }, move: { GK: [-18, 0], LD: [-9, -8], RD: [-9, 8], LW: [7, -13], RW: [7, 13], ST: [13, 0] }, dur: 2.2 },
            { say: 'The defenders step up but <b>stay behind the ball</b>. If we lose it, they\'re ready.',
              rings: { LD: YEL, RD: YEL }, links: [['LD', 'RD']] },
            { say: 'The keeper moves up to the top of her box. She\'s like an extra defender behind the team.',
              rings: { GK: YEL }, zones: [{ rect: [-25, -11, -14, 11], color: YEL, opacity: 0.12 }] },
            { say: 'The <b>wingers</b> stay <b>wide and high</b>. The <b>striker</b> stays our highest player, up near their last defender.',
              rings: { LW: YEL, RW: YEL, ST: YEL } },
            { say: 'Now our centre mid has a triangle on each side to pass to. She picks the left.',
              links: [['CM', 'LW'], ['CM', 'ST'], ['LW', 'ST'], ['CM', 'RW'], ['RW', 'ST']], pass: { to: 'LW', delay: 1.4 } }
          ]
        },
        {
          id: 'shape-3', title: 'In their end', sub: 'Scoring spots in the attacking third',
          scene: {
            home: { GK: [-16, 0], LD: [-6, -7], RD: [-4, 6], CM: [6, 2], RW: [10, 13], ST: [15, 0], LW: [12, -12] },
            away: S.attBallAway, ball: 'RW', camera: { target: [12, 0], dist: 38, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Our right wing dribbles into their end. Time to get into <b>scoring spots</b>!',
              dribble: { who: 'RW', to: [16, 12] }, dur: 1.6 },
            { say: 'The <b>striker</b> goes to the middle in front of goal. The <b>far winger</b> runs to the <b>back post</b>, the far side of the goal.',
              move: { ST: [20, 0], LW: [18, -7] }, arrows: [['ST', [20, 0], 'run'], ['LW', [18, -7], 'run']] },
            { say: 'The <b>centre mid</b> waits near the top of the box. Lots of goals come from passes rolled back to that spot.',
              move: { CM: [12, 2] }, zones: [{ at: [12, 2], r: 2.5, pulse: true }] },
            { say: 'Our defenders push up toward halfway, ready to win the ball if it gets cleared. The keeper steps up too.',
              move: { LD: [-2, -7], RD: [0, 6], GK: [-13, 0] }, cam: 'broadcast' },
            { say: 'The winger rolls it across the goal... and the back-post run pays off!',
              cam: { target: [16, 0], dist: 28, theta: 0.2, phi: 0.9 }, pass: { to: 'LW', delay: 0.3, dur: 1 }, shoot: { from: 'LW', delay: 1.6, to: [25.6, -1.4] } }
          ]
        },
        {
          id: 'shape-4', title: 'Slide with the ball', sub: 'Ball side, weak side',
          scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: 'top' },
          beats: [
            { say: 'Their player has the ball on our <b>right</b>. The whole team slides toward it. The side with the ball is the <b>ball side</b>.',
              zones: [{ rect: [-25, 2, 25, 17], color: ORANGE, opacity: 0.14 }], notes: [[[-14, 12], 'Ball side']] },
            { say: 'The far side is the <b>weak side</b>. Players over there <b>tuck in</b> toward the middle, because the ball can\'t hurt us from way over there.',
              zones: [{ rect: [-25, -17, 25, -2], color: BLUE, opacity: 0.14 }], notes: [[[-14, -12], 'Weak side']], rings: { LW: BLUE, LD: BLUE } },
            { say: 'Now they switch it across to the other side...',
              pass: { from: 'away:M1', to: 'away:M3', lofted: 2.4, dur: 1.4 } },
            { say: 'Everyone slides across together! The left side moves up to press, the right side tucks in.',
              move: { LW: [7.2, -11], LD: [-4, -9], CM: [-2, -3], RD: [-8, 0], RW: [-4, 5], ST: [5, 1], GK: [-20, -1.5] },
              arrows: [['LW', [7.2, -11], 'run'], ['RW', [-4, 5], 'run']], dur: 1.8 },
            { say: 'Think of our team as one shape that slides left and right like a windshield wiper, staying close together the whole time.',
              links: [['LW', 'LD'], ['LD', 'CM'], ['CM', 'RD'], ['RD', 'RW'], ['RW', 'CM'], ['CM', 'LW'], ['ST', 'CM']] }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'attack', title: 'We Have the Ball', blurb: 'Get open, make triangles, scan, decide, and switch.',
      lessons: [
        {
          id: 'attack-1', title: 'Get open', sub: 'Find a clear passing lane',
          scene: {
            home: { GK: [-18, 0], LD: [-9, -8], RD: [-9, 8], CM: [-2, 0], LW: [6, -7], RW: [7, 13], ST: [13, 0] },
            away: { GK: [23, 0], D1: [14, -5], D2: [14, 5], M1: [3, -4.5], M2: [4, 2], M3: [6, 9], F: [-5, 2] },
            ball: 'CM', you: 'LW', camera: { target: [3, -3], dist: 30, theta: 0.1, phi: 0.95 }
          },
          beats: [
            { say: 'Our centre mid has the ball and you want it. But there\'s a defender standing <b>right in the passing lane</b>.',
              arrows: [['CM', 'LW', 'pass', 0, 'bad']], tags: { 'away:M1': 'Blocking!' } },
            { say: 'To <b>get open</b>, move until you can see the ball with nobody in between. A few steps can change everything.',
              move: { LW: [7, -12.5] }, arrows: [['LW', [7, -12.5], 'run']], dur: 1.2 },
            { say: 'Now the lane is clear. Pass!',
              arrows: [['CM', 'LW', 'pass', 0, 'good']], pass: { to: 'LW', delay: 0.6 } },
            { say: 'Rule of thumb: if you can draw a straight line from the ball to you without crossing a defender, you\'re <b>open</b>. If not, move!',
              think: { LW: 'I\'m open!' } }
          ]
        },
        {
          id: 'attack-2', title: 'Triangles', sub: 'Always give two options',
          scene: {
            home: { GK: [-20, 0], LD: [-8, -10], RD: [-10, 7], CM: [-4, -3], LW: [0, -14], RW: [6, 12], ST: [8, 0] },
            away: { GK: [23, 0], D1: [12, -6], D2: [12, 5], M1: [-6, -8.5], M2: [2, -2], M3: [5, 8], F: [-12, 2] },
            ball: 'LD', camera: { target: [-3, -7], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'A defender is pressing our left back. She needs <b>options</b>. Two teammates nearby, at different angles, make a <b>triangle</b>.',
              links: [['LD', 'CM'], ['CM', 'LW'], ['LW', 'LD']] },
            { say: 'Now she has two easy passes, one up the line and one inside. The defender can\'t block both!',
              links: [['LD', 'CM'], ['CM', 'LW'], ['LW', 'LD']], arrows: [['LD', 'LW', 'pass'], ['LD', 'CM', 'pass']] },
            { say: 'She passes inside. Straight away the triangle moves with the ball: the striker comes over to make a new angle.',
              pass: { to: 'CM' }, move: { ST: [5, -6] }, wait: 0.2, dur: 1.4 },
            { say: 'New triangle, new options. Triangles everywhere means there\'s always someone to pass to.',
              links: [['CM', 'LW'], ['CM', 'ST'], ['LW', 'ST']], pass: { to: 'ST', delay: 1 } }
          ]
        },
        {
          id: 'attack-3', title: 'Check your shoulder', sub: 'Scanning before the ball arrives',
          scene: {
            home: { GK: [-20, 0], LD: [-10, -9], RD: [-10, 8], CM: [-3, 0], LW: [5, -13], RW: [6, 12], ST: [12, 0] },
            away: { GK: [23, 0], D1: [13, -6], D2: [13, 5], M1: [3, -7], M2: [-1, -2.5], M3: [6, 7], F: [-12, 3] },
            ball: 'LD', you: 'CM', camera: { target: [-4, -3], dist: 28, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Great players look around <b>before</b> the ball arrives. It\'s called <b>scanning</b>. Let\'s see the field through your eyes.',
              pov: 'CM' },
            { say: 'Quick look over one shoulder, then the other. Who\'s near you? Where\'s the space?',
              pov: 'CM', scan: true, dur: 4 },
            { say: 'You spotted a defender behind your <b>left</b> shoulder, and space on your <b>right</b>. You know your plan before the ball even gets to you!',
              tags: { 'away:M2': 'Defender here' }, zones: [{ at: [3, 4], r: 3, color: GOOD, pulse: true }] },
            { say: 'The pass comes in, and your first touch goes into the space, away from the defender.',
              pass: { to: 'CM' }, dribble: { who: 'CM', to: [3, 4], dur: 1.3 }, wait: 0.9, arrows: [['CM', [3, 4], 'dribble']] },
            { say: 'Researchers who study pro players found the ones who look around more tend to complete more passes. Rule of thumb: <b>look, then look again</b>.',
              think: { CM: 'Saw it coming!' } }
          ]
        },
        {
          id: 'attack-4', title: 'Pass, dribble or shoot?', sub: 'Making the choice',
          scene: {
            home: { GK: [-16, 0], LD: [-4, -8], RD: [-4, 8], CM: [9, 1], LW: [13, -12], RW: [16, 11], ST: [18, -3] },
            away: { GK: [23.5, 0], D1: [18.5, -1], D2: [19, 5], M1: [12, -7], M2: [12.5, 4], M3: [6, 10], F: [-4, 0] },
            ball: 'CM', you: 'CM', camera: { target: [14, 0], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'You have the ball. You have three choices: <b>pass</b>, <b>dribble</b> or <b>shoot</b>. Smart players choose fast.' },
            { say: '<b>Shoot</b> when you can see the goal and you\'re close enough to score. Here, defenders block the way and you\'re far out.',
              arrows: [['CM', [25, 0], 'pass', 0, 'bad']] },
            { say: '<b>Pass</b> when a teammate is in a better spot than you, like more open or closer to goal. Our right wing is open!',
              arrows: [['CM', 'RW', 'pass', 0, 'good']], rings: { RW: GOOD } },
            { say: '<b>Dribble</b> when there\'s open space in front of you. Run with the ball into it.',
              arrows: [['CM', [12, -2], 'dribble', 0, 'good']], zones: [{ at: [13.5, -2], r: 2.2, color: GOOD }] },
            { say: 'Rule of thumb: <b>look forward first</b>. Can I score? Can I pass forward? If not, keep the ball with a pass sideways or back. That\'s not giving up, it\'s smart!',
              pass: { to: 'RW', delay: 0.8 } }
          ]
        },
        {
          id: 'attack-5', title: 'First touch and open body', sub: 'Turn forward with one touch',
          scene: {
            home: { GK: [-20, 0], LD: [-10, -9], RD: [-9, 9], CM: [-2, 2], LW: [5, -13], RW: [6, 13], ST: [12, 0] },
            away: { GK: [23, 0], D1: [13, -5], D2: [13, 5], M1: [4, -6], M2: [-1, -4], M3: [7, 7], F: [-13, 3] },
            ball: 'RD', you: 'CM', camera: { target: [-3, 2], dist: 24, theta: 0.3, phi: 0.95 }
          },
          beats: [
            { say: 'Before the pass arrives, <b>open your body</b>: stand sideways, so you can see where the ball is coming from <b>and</b> where you want to go.',
              think: { CM: 'I can see both ways!' }, arrows: [['RD', 'CM', 'pass'], ['CM', [8, 0], 'run', 0, YEL]] },
            { say: 'Get ready to take it on the foot <b>farther from the ball</b>, your back foot. That turns you to face forward in one touch.' },
            { say: 'Her first touch goes forward, away from the defender. One touch and she\'s facing their goal!',
              pass: { to: 'CM' }, dribble: { who: 'CM', to: [4, 4], dur: 1.1 }, wait: 0.9 },
            { say: 'If a defender is tight behind you and you can\'t turn, <b>shield</b>: keep your body between her and the ball, then pass back to a teammate who can see forward.',
              move: { 'away:M2': [3, 3] }, think: { CM: 'Too tight, I\'ll shield.' }, dur: 1 }
          ]
        },
        {
          id: 'attack-6', title: 'Give-and-go', sub: 'Beat a defender with a 2 v 1',
          scene: {
            home: { GK: [-16, 0], LD: [-5, -8], RD: [-5, 8], CM: [3, 2], LW: [6, -12], RW: [9, 13], ST: [13, -5] },
            away: { GK: [23, 0], D1: [13, -10], D2: [15, 2], M1: [5, -5], M2: [6, 5], M3: [8, 10], F: [-6, 0] },
            ball: 'LW', camera: { target: [11, -7], dist: 26, theta: 0.15, phi: 0.92 }
          },
          beats: [
            { say: 'Two of us against one defender is called a <b>2 v 1</b>. That\'s a great chance!',
              rings: { LW: YEL, ST: YEL, 'away:D1': BAD } },
            { say: 'Dribble at the defender to make her come to you...',
              dribble: { who: 'LW', to: [9.5, -11] }, move: { 'away:D1': [11.3, -10.6] }, dur: 1.2 },
            { say: '...pass to your teammate and <b>sprint past</b> the defender...',
              pass: { to: 'ST' }, move: { LW: [16, -11] }, arrows: [['LW', [16, -11], 'run']], wait: 0.1, dur: 1.4 },
            { say: '...and get it straight back. That\'s a <b>give-and-go</b>, also called a wall pass. Now shoot!',
              pass: { from: 'ST', to: 'LW', dur: 0.6 }, shoot: { from: 'LW', delay: 1.1, to: [25.6, -1.6] } }
          ]
        },
        {
          id: 'attack-7', title: 'Switch the play', sub: 'Crowded side? Go to the other side',
          scene: {
            home: { GK: [-16, 0], LD: [-6, -8], RD: [-3, 9], CM: [2, 3], LW: [8, -13], RW: [7, 13], ST: [13, 4] },
            away: { GK: [23, 0], D1: [13, -1], D2: [12, 8], M1: [8, 10], M2: [5, 6], M3: [9, 12.5], F: [-3, 8] },
            ball: 'RW', camera: 'top'
          },
          beats: [
            { say: 'The other team has crowded our <b>right</b> side. Lots of legs, no space.',
              zones: [{ rect: [2, 4, 16, 17], color: BAD, opacity: 0.18 }] },
            { say: 'Look at the <b>other</b> side: our left wing is all alone!',
              rings: { LW: GOOD }, zones: [{ rect: [4, -17, 18, -6], color: GOOD, opacity: 0.18 }] },
            { say: 'Move it across: right wing to centre mid, centre mid to the left wing. That\'s a <b>switch</b>.',
              pass: { to: 'CM' }, arrows: [['RW', 'CM', 'pass'], ['CM', 'LW', 'pass']] },
            { say: 'Switch!',
              pass: { from: 'CM', to: 'LW', delay: 0.2, dur: 1.1 }, calls: { RW: 'SWITCH!' } },
            { say: 'Now our left wing has space to run into, and their whole team has to run across. Switch when one side is crowded!',
              dribble: { who: 'LW', to: [16, -12] }, move: { 'away:D1': [15, -6], 'away:M2': [8, -2] }, dur: 1.6 }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'defend', title: 'They Have the Ball', blurb: 'Goal-side, pressure-cover-balance, squeeze, 1 v 1, recovery runs.',
      lessons: [
        {
          id: 'defend-1', title: 'Goal-side', sub: 'Between your player and your goal',
          scene: {
            home: { GK: [-22, 0], LD: [-12, -4], RD: [-3, 9], CM: [-4, 0], LW: [0, -9], RW: [6, 10], ST: [8, 0] },
            away: { GK: [23, 0], D1: [10, -6], D2: [10, 5], M1: [-2, -6], M2: [2, 3], M3: [-7, 6], F: [-14, 2] },
            ball: 'away:M3', you: 'RD', camera: { target: [-8, 4], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'When they have the ball, ask: am I <b>goal-side</b>? That means standing between your player and your own goal.',
              arrows: [['away:M3', 'ourgoal', 'run', 0, BAD]] },
            { say: 'Right now you\'re on the <b>wrong side</b>. Your player is closer to our goal than you are!',
              rings: { RD: BAD }, tags: { RD: 'Wrong side!' } },
            { say: 'Run back on a line toward our goal until you\'re between the attacker and the goal.',
              move: { RD: [-10.5, 4.5] }, arrows: [['RD', [-10.5, 4.5], 'run']], dur: 1.5 },
            { say: 'Goal-side, and a little toward the middle. Now you can see the ball and your player, and you\'re protecting the goal.',
              rings: { RD: GOOD }, tags: { RD: 'Goal-side' } }
          ]
        },
        {
          id: 'defend-2', title: 'Pressure, cover, balance', sub: 'Three jobs when they have it',
          scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: { target: [-2, 3], dist: 34, theta: 0.15, phi: 0.95 } },
          beats: [
            { say: 'When they have the ball, three jobs need doing. Job 1: <b>Pressure</b>. The closest player goes to the ball.',
              rings: { RW: ORANGE }, tags: { RW: 'Pressure' }, arrows: [[[4, 12], 'RW', 'run', 0, ORANGE]] },
            { say: 'Job 2: <b>Cover</b>. Teammates stand behind the presser, at an angle, ready if she gets beaten.',
              rings: { RD: YEL, CM: YEL }, tags: { RD: 'Cover', CM: 'Cover', RW: 'Pressure' } },
            { say: 'Job 3: <b>Balance</b>. Everyone else tucks in toward the middle to guard the space in front of our goal.',
              rings: { LD: BLUE, LW: BLUE }, tags: { LD: 'Balance', LW: 'Balance', RW: 'Pressure', RD: 'Cover', CM: 'Cover' } },
            { say: 'Pressure, cover, balance. Like a stack of shields: if one gets beaten, the next one is ready.',
              links: [['RW', 'RD', ORANGE], ['RW', 'CM', ORANGE], ['CM', 'LD'], ['LD', 'LW'], ['RD', 'LD']] },
            { say: 'Who presses? Whoever is closest. Who covers? The next closest. Talk to sort it out!',
              calls: { RW: 'I\'VE GOT BALL!', RD: 'COVERING!' } }
          ]
        },
        {
          id: 'defend-3', title: 'Squeeze together', sub: 'Stay compact',
          scene: {
            home: { GK: [-22, 0], LD: [-10, -13], RD: [-10, 13], CM: [2, 0], LW: [6, -14], RW: [6, 14], ST: [12, 0] },
            away: { GK: [23, 0], D1: [12, -6], D2: [12, 6], M1: [-2, -6], M2: [6, 1], M3: [-1, 7], F: [-9, 1] },
            ball: 'away:M2', camera: 'top'
          },
          beats: [
            { say: 'Uh-oh. We\'re too spread out when <b>they</b> have the ball. Big gaps between us mean easy passes for them.',
              arrows: [['away:M2', 'away:F', 'pass', 0, BAD], ['away:M2', 'away:M1', 'pass', 0, BAD]], zones: [{ at: [-4, 0], r: 5, color: BAD }] },
            { say: '<b>Squeeze!</b> Get closer together and goal-side of the ball. Now the gaps are gone.',
              move: { LD: [-11, -4], RD: [-11, 4], CM: [-3, 0.5], LW: [-2, -7], RW: [-1.5, 6.5], ST: [4, 0.5], GK: [-21, 0] }, dur: 1.8 },
            { say: 'Compact means hard to play through. They have to go around us, out wide, where it\'s less dangerous.',
              links: [['LD', 'RD'], ['LW', 'CM'], ['CM', 'RW'], ['LD', 'LW'], ['RD', 'RW'], ['CM', 'ST']] },
            { say: 'Rule of thumb: when we have the ball, make the field <b>big</b>. When they have it, make it <b>small</b>.',
              notes: [[[-4, -15], 'Make it small']] }
          ]
        },
        {
          id: 'defend-4', title: 'Defending 1 v 1', sub: 'Patient, side-on, show her outside',
          scene: {
            home: { GK: [-22, 0], LD: [-11, -7], RD: [-10, 7], CM: [-4, 0], LW: [2, -8], RW: [3, 9], ST: [9, 0] },
            away: { GK: [23, 0], D1: [10, -6], D2: [10, 5], M1: [-2, -11], M2: [3, 1], M3: [1, 9], F: [-12, 3] },
            ball: 'away:M1', you: 'LD', camera: { target: [-8, -8], dist: 22, theta: 0.2, phi: 0.92 }
          },
          beats: [
            { say: 'An attacker is dribbling at you. Don\'t panic, and <b>don\'t dive in</b>!',
              dribble: { who: 'away:M1', to: [-5, -10] }, dur: 1.2 },
            { say: 'Get close, about an arm\'s length away. Stand <b>side-on</b> with your knees bent, ready to move either way.',
              move: { LD: [-7.4, -9] }, think: { LD: 'Patient... patient...' }, dur: 0.9 },
            { say: '<b>Show her the sideline</b>: stand a little to the inside so the only way forward is toward the sideline, away from our goal.',
              dribble: { who: 'away:M1', to: [-8.5, -14], dur: 1.6 }, move: { LD: [-9.6, -12.4] }, arrows: [[[-5, -10], [-9, -15], 'run', 0.1, YEL]], dur: 1.6 },
            { say: 'The sideline is like an extra defender. When she takes a big touch, pounce and win the ball!',
              pass: { from: 'away:M1', to: [-10.2, -14.6], dur: 0.5 }, move: { LD: [-10.4, -13.8] }, giveTo: 'LD', wait: 0.6, dur: 0.6,
              calls: { LD: 'GOT IT!' } }
          ]
        },
        {
          id: 'defend-5', title: 'Recovery runs', sub: 'Sprint back toward your goal',
          scene: {
            home: { GK: [-22, 0], LD: [-11, -5], RD: [-11, 5], CM: [4, -2], LW: [9, -10], RW: [10, 9], ST: [14, 0] },
            away: { GK: [23, 0], D1: [12, -6], D2: [13, 4], M1: [1, -6], M2: [-1, 3], M3: [3, 10], F: [-8, 1] },
            ball: 'away:M1', you: 'LW', camera: { target: [-2, -3], dist: 34, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'We lost the ball and they\'re running at our goal. If you\'re beaten, don\'t walk. <b>Sprint back!</b>',
              dribble: { who: 'away:M1', to: [-4, -6] }, dur: 1.4 },
            { say: 'But where to? <b>Not</b> straight at the ball. Run on a line toward <b>our goal</b>, so you end up goal-side.',
              arrows: [['LW', [-6, -7], 'run', 0, BAD], ['LW', [-11, -2], 'run', 0, GOOD]], notes: [[[-4, -10], 'Chasing the ball', 'bad'], [[-11, 2], 'Toward our goal', 'good']] },
            { say: 'Recovery run!',
              move: { LW: [-10, -3.5], CM: [-7, 1] }, dribble: { who: 'away:M1', to: [-7, -7], dur: 2 }, dur: 2 },
            { say: 'Now you\'re back between the ball and our goal, and the team is safe again. Recovery runs are a big part of being a great teammate.',
              rings: { LW: GOOD } }
          ]
        }
      ]
    }
  ];
})();
