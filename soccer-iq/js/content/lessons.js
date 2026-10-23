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
      id: 'field', title: 'Know Your Field', blurb: 'The 7v7 field, your team, and why we spread out.',
      lessons: [
        {
          id: 'field-1', title: 'The 7v7 field', sub: 'Thirds, boxes and the dashed lines',
          scene: { home: S.kickoff, away: S.kickoffAway, ball: [0, 0], camera: 'broadcast' },
          beats: [
            { say: 'Each team has six players plus a keeper. That\'s <b>7 v 7</b>. In Pitch IQ we wear <b>blue</b>, and we always attack to the right.',
              arrows: [[[-6, -15], [8, -15], 'run']], tags: { GK: 'Our keeper', 'away:GK': 'Their keeper' } },
            { say: 'The field is cut into three parts, called <b>thirds</b>. Near our goal is our <b>defending third</b>. Then comes the middle third. Near their goal is the attacking third.',
              zones: [{ rect: [-25, -17, -RL, 17], color: BLUE, opacity: 0.18 }, { rect: [-RL, -17, RL, 17], color: YEL, opacity: 0.14 }, { rect: [RL, -17, 25, 17], color: ORANGE, opacity: 0.18 }],
              notes: [[[-17, 0], 'Defending third'], [[0, -9], 'Middle third'], [[17, 0], 'Attacking third']], cam: 'top' },
            { say: 'Near our goal, be <b>careful</b>. A mistake there can give away a goal. Near their goal, be <b>brave</b>. Trying something there can score one!',
              zones: [{ rect: [-25, -17, -RL, 17], color: BLUE, opacity: 0.18 }, { rect: [RL, -17, 25, 17], color: ORANGE, opacity: 0.18 }],
              notes: [[[-17, 0], 'Be careful'], [[17, 0], 'Be brave']] },
            { say: 'See the dashed lines? They\'re called <b>retreat lines</b>. When our keeper has the ball, or we take a goal kick, the other team must go back behind that line. That gives us room to pass.',
              zones: [{ rect: [-RL - 0.35, -17, -RL + 0.35, 17], color: BLUE, opacity: 0.5 }], notes: [[[-RL, -12], 'Retreat line']], cam: 'broadcast' },
            { say: 'The big box in front of each goal is the <b>penalty area</b>. The keeper can only use her hands inside her own box.',
              zones: [{ rect: [-25, -11, -14, 11], color: YEL, opacity: 0.2 }], rings: { GK: YEL }, cam: { target: [-17, 0], dist: 30, theta: 0.3, phi: 0.95 } },
            { say: 'Good news: 7v7 has <b>no offside</b> rule, so you can stand anywhere. But standing in a <b>smart</b> spot still wins games. That\'s what Pitch IQ is all about!',
              cam: 'broadcast', think: { ST: 'No offside? Cool!' } }
          ]
        },
        {
          id: 'field-2', title: 'Meet your team', sub: 'The 2-3-1 and what each player does',
          scene: { home: S.midBall, ball: 'CM', camera: 'broadcast' },
          beats: [
            { say: 'Lots of 7v7 teams line up in a <b>2-3-1</b>. Skip the keeper and count from our goal. That\'s 2 defenders, 3 in the middle, and 1 striker up front.',
              tags: { GK: 'Keeper', LD: 'Left back', RD: 'Right back', LW: 'Left wing', CM: 'Centre mid', RW: 'Right wing', ST: 'Striker' } },
            { say: 'The <b>keeper</b> stops shots and talks to her team. She starts our attacks by rolling or throwing the ball.',
              rings: { GK: YEL }, think: { GK: 'I can see the whole field from here!' }, cam: { target: [-14, 0], dist: 28, theta: 0.2, phi: 0.95 } },
            { say: 'Our two <b>defenders</b> are the left back and the right back. Their first job is to defend. When we have the ball, they spread out to the sides for an easy pass.',
              rings: { LD: YEL, RD: YEL }, cam: { target: [-9, 0], dist: 32, theta: 0, phi: 0.95 } },
            { say: 'The <b>wingers</b> play out near the sidelines, one on each side. They attack down the sides, then run back to help defend.',
              rings: { LW: YEL, RW: YEL }, arrows: [['LW', [16, -13], 'run'], ['RW', [16, 13], 'run']], cam: { target: [7, 0], dist: 34, theta: 0, phi: 0.95 } },
            { say: 'The <b>centre mid</b> plays in the middle. She connects our defenders and our striker. She stays close to the ball to help, when we attack and when we defend.',
              rings: { CM: YEL }, think: { CM: 'Pass to me anytime!' }, cam: { target: [0, 0], dist: 28, theta: 0, phi: 0.95 } },
            { say: 'The <b>striker</b> plays closest to their goal. She keeps their defenders pushed back, which gives us more room. She is often first to the ball in front of their goal.',
              rings: { ST: YEL }, cam: { target: [12, 0], dist: 28, theta: 0, phi: 0.95 } },
            { say: 'Coaches call the way we line up our <b>shape</b>. Yours might be a 3-2-1, with three defenders. Every shape has one idea: spread out and help each other. Good coaches let everyone try each position.',
              links: [['GK', 'LD'], ['GK', 'RD'], ['LD', 'CM'], ['RD', 'CM'], ['LD', 'LW'], ['RD', 'RW'], ['CM', 'ST'], ['LW', 'ST'], ['RW', 'ST']], cam: 'broadcast' }
          ]
        },
        {
          id: 'field-3', title: 'Spread out!', sub: 'Use the whole field',
          scene: { home: S.midBall, away: S.midBallAway, ball: 'CM', camera: 'broadcast' },
          beats: [
            { say: 'When everyone runs to the ball it\'s called <b>bunching</b>, or the <b>beehive</b>. Watch...',
              move: { LW: [2.5, -2.5], RW: [2.5, 2.5], ST: [3.5, 0.5], LD: [-2, -2.5], RD: [-2, 2.5], 'away:M1': [3, -1.5], 'away:M3': [3.5, 2.8], 'away:F': [-1.5, 1] }, dur: 1.8 },
            { say: 'All bunched up, there\'s nobody to pass to. And one big kick gets the ball past all of us. Not good!',
              think: { CM: 'Help! Nowhere to pass!' }, cam: { target: [1, 0], dist: 20, theta: 0.4, phi: 0.9 } },
            { say: '<b>Width</b> means using the whole field, from side to side. The wingers go out near the sidelines. The defenders move apart.',
              move: { LW: [7, -13], RW: [7, 13], LD: [-9, -8], RD: [-9, 8], 'away:M1': [6, -8], 'away:M3': [6, 8], 'away:F': [-4, -2] },
              arrows: [[[2.5, -2.5], [7, -13], 'run'], [[2.5, 2.5], [7, 13], 'run']], cam: 'broadcast', dur: 1.6 },
            { say: '<b>Depth</b> means someone ahead of the ball and someone behind it. The striker stays up near their goal. The defenders stay back.',
              move: { ST: [13, 0] }, links: [['ST', 'CM'], ['CM', 'LD'], ['CM', 'RD']], tags: { ST: 'Ahead', LD: 'Behind', RD: 'Behind' } },
            { say: 'Spread out, our team looks like a big kite. Now there are open paths to pass along everywhere. Tip: stay <b>one good pass away</b> from your teammates, not right next to them.',
              links: [['GK', 'LD'], ['GK', 'RD'], ['LD', 'CM'], ['RD', 'CM'], ['LD', 'LW'], ['RD', 'RW'], ['CM', 'ST'], ['LW', 'ST'], ['RW', 'ST'], ['CM', 'LW'], ['CM', 'RW']],
              pass: { to: 'RW', delay: 1.2 } }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'shape', title: 'Where Do I Stand?', blurb: 'Where to stand when the ball is near our goal, in the middle, or near theirs.',
      lessons: [
        {
          id: 'shape-1', title: 'Keeper has the ball', sub: 'Spread out and use the retreat line',
          scene: {
            home: { GK: [-23, 0], LD: [-19, -4], RD: [-19, 4], CM: [-14, 0], LW: [-10, -11], RW: [-10, 11], ST: [-4, 0] },
            away: { GK: [23, 0], D1: [4, -6], D2: [4, 6], M1: [-14, -7], M2: [-13, 3], M3: [-15, 8], F: [-17, -1] },
            ball: 'GK', camera: { target: [-12, 0], dist: 38, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Our keeper just caught the ball. Now the other team has to <b>go back</b> behind the dashed line. That\'s the retreat line.',
              whistle: true, move: { 'away:M1': [-5, -9], 'away:M2': [-3, 2], 'away:M3': [-5, 9], 'away:F': [-7, 0], 'away:D1': [8, -6], 'away:D2': [8, 6] },
              zones: [{ rect: [-RL - 0.35, -17, -RL + 0.35, 17], color: BLUE, opacity: 0.55 }], dur: 2 },
            { say: 'Our <b>defenders spread out</b> to the sides, by the edge of the big box. That pulls the other team apart.',
              move: { LD: [-16, -11], RD: [-16, 11] }, arrows: [['LD', [-16, -11], 'run'], ['RD', [-16, 11], 'run']] },
            { say: 'Our <b>centre mid</b> comes back to the middle, open for a pass. The wingers stay out wide. The <b>striker</b> stays up front to push their defenders back.',
              move: { CM: [-11, 1], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] }, cam: 'broadcast' },
            { say: 'Now the keeper has easy choices. She rolls it to a defender out by the side, away from danger in the middle.',
              pass: { to: 'RD', delay: 0.3, dur: 1 }, arrows: [['GK', 'RD', 'pass']] },
            { say: 'Once we touch the ball, they can come forward. One of them runs at our right back. So she looks up the sideline and passes to her winger.',
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
            { say: 'When the ball moves up the field, the whole team moves up too. It\'s like we\'re all tied together with a <b>rubber band</b>.',
              dribble: { who: 'CM', to: [0, 0] }, move: { GK: [-18, 0], LD: [-9, -8], RD: [-9, 8], LW: [7, -13], RW: [7, 13], ST: [13, 0] }, dur: 2.2 },
            { say: 'The defenders step up but <b>stay behind the ball</b>. If we lose it, they\'re ready.',
              rings: { LD: YEL, RD: YEL }, links: [['LD', 'RD']] },
            { say: 'The keeper moves up to the front edge of her box. She\'s like an extra defender behind the team.',
              rings: { GK: YEL }, zones: [{ rect: [-25, -11, -14, 11], color: YEL, opacity: 0.12 }] },
            { say: 'The <b>wingers</b> stay out wide and up the field. The <b>striker</b> stays closest to their goal, up near their last defender.',
              rings: { LW: YEL, RW: YEL, ST: YEL } },
            { say: 'On each side, our centre mid and two teammates make a <b>triangle</b>. That gives her two passes to choose from. She picks the left.',
              links: [['CM', 'LW'], ['CM', 'ST'], ['LW', 'ST'], ['CM', 'RW'], ['RW', 'ST']], pass: { to: 'LW', delay: 1.4 } }
          ]
        },
        {
          id: 'shape-3', title: 'In their end', sub: 'Where to stand to score',
          scene: {
            home: { GK: [-16, 0], LD: [-6, -7], RD: [-4, 6], CM: [6, 2], RW: [10, 13], ST: [15, 0], LW: [12, -12] },
            away: S.attBallAway, ball: 'RW', camera: { target: [12, 0], dist: 38, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Our right wing dribbles into their end. Time to get into <b>scoring spots</b>!',
              dribble: { who: 'RW', to: [16, 12] }, dur: 1.6 },
            { say: 'The <b>striker</b> goes to the middle, in front of goal. Our other winger runs to the <b>back post</b>. That\'s the far side of the goal.',
              move: { ST: [20, 0], LW: [18, -7] }, arrows: [['ST', [20, 0], 'run'], ['LW', [18, -7], 'run']] },
            { say: 'The <b>centre mid</b> waits near the front edge of the big box. Lots of goals come from passes rolled back to that spot.',
              move: { CM: [12, 2] }, zones: [{ at: [12, 2], r: 2.5, pulse: true }] },
            { say: 'Our defenders move up toward the halfway line. If they kick it away, we\'re ready to win it back. The keeper steps up too.',
              move: { LD: [-2, -7], RD: [0, 6], GK: [-13, 0] }, cam: 'broadcast' },
            { say: 'The winger rolls it across the goal... and the run to the back post pays off!',
              cam: { target: [16, 0], dist: 28, theta: 0.2, phi: 0.9 }, pass: { to: 'LW', delay: 0.3, dur: 1 }, shoot: { from: 'LW', delay: 1.6, to: [25.6, -1.4] } }
          ]
        },
        {
          id: 'shape-4', title: 'Slide with the ball', sub: 'Ball side, weak side',
          scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: 'top' },
          beats: [
            { say: 'Their player has the ball on our <b>right</b>. The whole team slides toward it. The side with the ball is the <b>ball side</b>.',
              zones: [{ rect: [-25, 2, 25, 17], color: ORANGE, opacity: 0.14 }], notes: [[[-14, 12], 'Ball side']] },
            { say: 'The side away from the ball is the <b>weak side</b>. Players there <b>move in</b> toward the middle. The ball can\'t hurt us from way over there.',
              zones: [{ rect: [-25, -17, 25, -2], color: BLUE, opacity: 0.14 }], notes: [[[-14, -12], 'Weak side']], rings: { LW: BLUE, LD: BLUE } },
            { say: 'Now they kick it all the way across to the other side...',
              pass: { from: 'away:M1', to: 'away:M3', lofted: 2.4, dur: 1.4 } },
            { say: 'Everyone slides across together! Our left side moves up to <b>press</b>: they run at the ball to win it. Our right side moves in.',
              move: { LW: [7.2, -11], LD: [-4, -9], CM: [-2, -3], RD: [-8, 0], RW: [-4, 5], ST: [5, 1], GK: [-20, -1.5] },
              arrows: [['LW', [7.2, -11], 'run'], ['RW', [-4, 5], 'run']], dur: 1.8 },
            { say: 'Our team moves like one big shape. It slides left and right like a <b>windshield wiper</b>. We stay close together the whole time.',
              links: [['LW', 'LD'], ['LD', 'CM'], ['CM', 'RD'], ['RD', 'RW'], ['RW', 'CM'], ['CM', 'LW'], ['ST', 'CM']] }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'attack', title: 'We Have the Ball', blurb: 'Get open, make triangles, look around, choose, and switch sides.',
      lessons: [
        {
          id: 'attack-1', title: 'Get open', sub: 'Find a clear path for the pass',
          scene: {
            home: { GK: [-18, 0], LD: [-9, -8], RD: [-9, 8], CM: [-2, 0], LW: [6, -7], RW: [7, 13], ST: [13, 0] },
            away: { GK: [23, 0], D1: [14, -5], D2: [14, 5], M1: [3, -4.5], M2: [4, 2], M3: [6, 9], F: [-5, 2] },
            ball: 'CM', you: 'LW', camera: { target: [3, -3], dist: 30, theta: 0.1, phi: 0.95 }
          },
          beats: [
            { say: 'Our centre mid has the ball, and you want it. But a defender is standing <b>right in the way</b> of the pass.',
              arrows: [['CM', 'LW', 'pass', 0, 'bad']], tags: { 'away:M1': 'Blocking!' } },
            { say: 'To <b>get open</b>, move until you can see the ball with nobody in between. A few steps can make a big difference.',
              move: { LW: [7, -12.5] }, arrows: [['LW', [7, -12.5], 'run']], dur: 1.2 },
            { say: 'Now the path is clear. Pass!',
              arrows: [['CM', 'LW', 'pass', 0, 'good']], pass: { to: 'LW', delay: 0.6 } },
            { say: 'Tip: picture a straight line from the ball to you. If no defender is on it, you\'re <b>open</b>. If one is, move!',
              think: { LW: 'I\'m open!' } }
          ]
        },
        {
          id: 'attack-2', title: 'Triangles', sub: 'Always give two choices',
          scene: {
            home: { GK: [-20, 0], LD: [-8, -10], RD: [-10, 7], CM: [-4, -3], LW: [0, -14], RW: [6, 12], ST: [8, 0] },
            away: { GK: [23, 0], D1: [12, -6], D2: [12, 5], M1: [-6, -8.5], M2: [2, -2], M3: [5, 8], F: [-12, 2] },
            ball: 'LD', camera: { target: [-3, -7], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'A defender runs at our left back to win the ball. She needs someone to pass to! Two teammates come close, in different spots. Together they make a <b>triangle</b>.',
              links: [['LD', 'CM'], ['CM', 'LW'], ['LW', 'LD']] },
            { say: 'Now she has two easy passes: one up the sideline, and one to the middle. The defender can\'t block <b>both</b>!',
              links: [['LD', 'CM'], ['CM', 'LW'], ['LW', 'LD']], arrows: [['LD', 'LW', 'pass'], ['LD', 'CM', 'pass']] },
            { say: 'She passes to the middle. Right away, the triangle moves with the ball. The striker comes over to make a new one.',
              pass: { to: 'CM' }, move: { ST: [5, -6] }, wait: 0.2, dur: 1.4 },
            { say: 'New triangle, new choices. With <b>triangles</b> everywhere, there\'s always someone to pass to.',
              links: [['CM', 'LW'], ['CM', 'ST'], ['LW', 'ST']], pass: { to: 'ST', delay: 1 } }
          ]
        },
        {
          id: 'attack-3', title: 'Check your shoulder', sub: 'Look around before the ball comes',
          scene: {
            home: { GK: [-20, 0], LD: [-10, -9], RD: [-10, 8], CM: [-3, 0], LW: [5, -13], RW: [6, 12], ST: [12, 0] },
            away: { GK: [23, 0], D1: [13, -6], D2: [13, 5], M1: [3, -7], M2: [-1, -2.5], M3: [6, 7], F: [-12, 3] },
            ball: 'LD', you: 'CM', camera: { target: [-4, -3], dist: 28, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'Great players look around <b>before</b> the ball arrives. It\'s called <b>scanning</b>. Let\'s see the field through your eyes.',
              pov: 'CM' },
            { say: 'Quick look over one shoulder, then the other. Who\'s near you? Where\'s the open space?',
              pov: 'CM', scan: true, dur: 4 },
            { say: 'You saw a defender behind your <b>left</b> shoulder. And open space on your <b>right</b>. Now you have a plan before the ball even gets to you!',
              tags: { 'away:M2': 'Defender here' }, zones: [{ at: [3, 4], r: 3, color: GOOD, pulse: true }] },
            { say: 'Here comes the pass. Your first touch pushes the ball into the open space, away from the defender.',
              pass: { to: 'CM' }, dribble: { who: 'CM', to: [3, 4], dur: 1.3 }, wait: 0.9, arrows: [['CM', [3, 4], 'dribble']] },
            { say: 'Scientists studied pro players. The ones who looked around more usually made more passes that reached a teammate. Tip: <b>look, then look again</b>.',
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
            { say: '<b>Shoot</b> when you can see the goal and you\'re close enough to score. Here, defenders block the way, and you\'re too far away.',
              arrows: [['CM', [25, 0], 'pass', 0, 'bad']] },
            { say: '<b>Pass</b> when a teammate is in a better spot than you. Maybe she\'s more open, or closer to goal. Our right wing is open!',
              arrows: [['CM', 'RW', 'pass', 0, 'good']], rings: { RW: GOOD } },
            { say: '<b>Dribble</b> when there\'s open space in front of you. Run with the ball into it.',
              arrows: [['CM', [12, -2], 'dribble', 0, 'good']], zones: [{ at: [13.5, -2], r: 2.2, color: GOOD }] },
            { say: 'Tip: <b>look forward first</b>. Can I score? Can I pass forward? If not, keep the ball with a pass sideways or back. That\'s not giving up. It\'s smart!',
              pass: { to: 'RW', delay: 0.8 } }
          ]
        },
        {
          id: 'attack-5', title: 'Your first touch', sub: 'Stand sideways and turn in one touch',
          scene: {
            home: { GK: [-20, 0], LD: [-10, -9], RD: [-9, 9], CM: [-2, 2], LW: [5, -13], RW: [6, 13], ST: [12, 0] },
            away: { GK: [23, 0], D1: [13, -5], D2: [13, 5], M1: [4, -6], M2: [-1, -4], M3: [7, 7], F: [-13, 3] },
            ball: 'RD', you: 'CM', camera: { target: [-3, 2], dist: 24, theta: 0.3, phi: 0.95 }
          },
          beats: [
            { say: 'Before the pass comes, stand <b>sideways</b>. Now you can see where the ball is coming from and where you want to go. Coaches call this opening your body.',
              think: { CM: 'I can see both ways!' }, arrows: [['RD', 'CM', 'pass'], ['CM', [8, 0], 'run', 0, YEL]] },
            { say: 'Get ready to take the ball on the foot <b>farther from it</b>. Coaches call that your back foot. It turns you to face forward in one touch.' },
            { say: 'Her first touch pushes the ball forward, away from the defender. One touch, and she\'s facing their goal!',
              pass: { to: 'CM' }, dribble: { who: 'CM', to: [4, 4], dur: 1.1 }, wait: 0.9 },
            { say: 'Is a defender right behind you, so you can\'t turn? Then <b>shield</b> it: keep your body between her and the ball. Then pass back to a teammate who is facing forward.',
              move: { 'away:M2': [3, 3] }, think: { CM: 'Too close! I\'ll shield it.' }, dur: 1 }
          ]
        },
        {
          id: 'attack-6', title: 'Give-and-go', sub: 'Two of us beat one defender',
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
            { say: '...and get the ball right back. You give it, then go! That\'s a <b>give-and-go</b>, also called a wall pass. Now shoot!',
              pass: { from: 'ST', to: 'LW', dur: 0.6 }, shoot: { from: 'LW', delay: 1.1, to: [25.6, -1.6] } }
          ]
        },
        {
          id: 'attack-7', title: 'Switch sides', sub: 'Crowded side? Go to the other side',
          scene: {
            home: { GK: [-16, 0], LD: [-6, -8], RD: [-3, 9], CM: [2, 3], LW: [8, -13], RW: [7, 13], ST: [13, 4] },
            away: { GK: [23, 0], D1: [13, -1], D2: [12, 8], M1: [8, 10], M2: [5, 6], M3: [9, 12.5], F: [-3, 8] },
            ball: 'RW', camera: 'top'
          },
          beats: [
            { say: 'The other team has lots of players on our <b>right</b> side. Lots of legs, no space.',
              zones: [{ rect: [2, 4, 16, 17], color: BAD, opacity: 0.18 }] },
            { say: 'Look at the <b>other</b> side: our left wing is all alone!',
              rings: { LW: GOOD }, zones: [{ rect: [4, -17, 18, -6], color: GOOD, opacity: 0.18 }] },
            { say: 'Move the ball across: right wing to centre mid, then centre mid to left wing. Moving it to the other side is a <b>switch</b>.',
              pass: { to: 'CM' }, arrows: [['RW', 'CM', 'pass'], ['CM', 'LW', 'pass']] },
            { say: 'Switch!',
              pass: { from: 'CM', to: 'LW', delay: 0.2, dur: 1.1 }, calls: { RW: 'SWITCH!' } },
            { say: 'Now our left wing has space to run into. Their whole team has to run across. Switch when one side is crowded!',
              dribble: { who: 'LW', to: [16, -12] }, move: { 'away:D1': [15, -6], 'away:M2': [8, -2] }, dur: 1.6 }
          ]
        }
      ]
    },
    // =====================================================================
    {
      id: 'defend', title: 'They Have the Ball', blurb: 'Guard our goal, help each other, squeeze in, stop a dribbler and sprint back.',
      lessons: [
        {
          id: 'defend-1', title: 'Goal-side', sub: 'Between your player and your goal',
          scene: {
            home: { GK: [-22, 0], LD: [-12, -4], RD: [-3, 9], CM: [-4, 0], LW: [0, -9], RW: [6, 10], ST: [8, 0] },
            away: { GK: [23, 0], D1: [10, -6], D2: [10, 5], M1: [-2, -6], M2: [2, 3], M3: [-7, 6], F: [-14, 2] },
            ball: 'away:M3', you: 'RD', camera: { target: [-8, 4], dist: 30, theta: 0.15, phi: 0.95 }
          },
          beats: [
            { say: 'When they have the ball, ask: am I <b>goal-side</b>? That means standing between the player you\'re guarding and our goal.',
              arrows: [['away:M3', 'ourgoal', 'run', 0, BAD]] },
            { say: 'Right now you\'re on the <b>wrong side</b>. Your player is closer to our goal than you are!',
              rings: { RD: BAD }, tags: { RD: 'Wrong side!' } },
            { say: 'Run back toward our goal. Keep going until you\'re between her and the goal.',
              move: { RD: [-10.5, 4.5] }, arrows: [['RD', [-10.5, 4.5], 'run']], dur: 1.5 },
            { say: 'Goal-side, and a little toward the middle. Now you can see the ball <b>and</b> your player. And you\'re guarding our goal.',
              rings: { RD: GOOD }, tags: { RD: 'Goal-side' } }
          ]
        },
        {
          id: 'defend-2', title: 'Pressure, cover, balance', sub: 'Three jobs when they have the ball',
          scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: { target: [-2, 3], dist: 34, theta: 0.15, phi: 0.95 } },
          beats: [
            { say: 'When they have the ball, we have three jobs. Job 1: <b>Pressure</b>. The closest player runs at the ball to try to win it.',
              rings: { RW: ORANGE }, tags: { RW: 'Pressure' }, arrows: [[[4, 12], 'RW', 'run', 0, ORANGE]] },
            { say: 'Job 2: <b>Cover</b>. Nearby teammates stand just behind her, off to the side. If the dribbler gets past her, they\'re ready to help.',
              rings: { RD: YEL, CM: YEL }, tags: { RD: 'Cover', CM: 'Cover', RW: 'Pressure' } },
            { say: 'Job 3: <b>Balance</b>. Everyone else moves in toward the middle. They guard the space in front of our goal.',
              rings: { LD: BLUE, LW: BLUE }, tags: { LD: 'Balance', LW: 'Balance', RW: 'Pressure', RD: 'Cover', CM: 'Cover' } },
            { say: 'Pressure, cover, balance. It\'s like a stack of shields. If someone gets past the first one, the next one is ready.',
              links: [['RW', 'RD', ORANGE], ['RW', 'CM', ORANGE], ['CM', 'LD'], ['LD', 'LW'], ['RD', 'LD']] },
            { say: 'Who goes to the ball? Whoever is closest. Who covers? The next closest. <b>Talk</b> to each other to sort it out!',
              calls: { RW: 'I\'VE GOT BALL!', RD: 'COVERING!' } }
          ]
        },
        {
          id: 'defend-3', title: 'Squeeze together', sub: 'Stay close together',
          scene: {
            home: { GK: [-22, 0], LD: [-10, -13], RD: [-10, 13], CM: [2, 0], LW: [6, -14], RW: [6, 14], ST: [12, 0] },
            away: { GK: [23, 0], D1: [12, -6], D2: [12, 6], M1: [-2, -6], M2: [6, 1], M3: [-1, 7], F: [-9, 1] },
            ball: 'away:M2', camera: 'top'
          },
          beats: [
            { say: 'Uh-oh. We\'re too spread out when <b>they</b> have the ball. Big gaps between us mean easy passes for them.',
              arrows: [['away:M2', 'away:F', 'pass', 0, BAD], ['away:M2', 'away:M1', 'pass', 0, BAD]], zones: [{ at: [-4, 0], r: 5, color: BAD }] },
            { say: '<b>Squeeze!</b> Get closer together, between the ball and our goal. Now the gaps are gone.',
              move: { LD: [-11, -4], RD: [-11, 4], CM: [-3, 0.5], LW: [-2, -7], RW: [-1.5, 6.5], ST: [4, 0.5], GK: [-21, 0] }, dur: 1.8 },
            { say: 'Coaches call this <b>compact</b>. Close together, we\'re hard to get through. They have to go around us, out to the sides, where it\'s less dangerous.',
              links: [['LD', 'RD'], ['LW', 'CM'], ['CM', 'RW'], ['LD', 'LW'], ['RD', 'RW'], ['CM', 'ST']] },
            { say: 'Tip: when we have the ball, make the field <b>big</b>. When they have it, make it <b>small</b>.',
              notes: [[[-4, -15], 'Make it small']] }
          ]
        },
        {
          id: 'defend-4', title: 'Defending 1 v 1', sub: 'Be patient and send her to the side',
          scene: {
            home: { GK: [-22, 0], LD: [-11, -7], RD: [-10, 7], CM: [-4, 0], LW: [2, -8], RW: [3, 9], ST: [9, 0] },
            away: { GK: [23, 0], D1: [10, -6], D2: [10, 5], M1: [-2, -11], M2: [3, 1], M3: [1, 9], F: [-12, 3] },
            ball: 'away:M1', you: 'LD', camera: { target: [-8, -8], dist: 22, theta: 0.2, phi: 0.92 }
          },
          beats: [
            { say: 'An attacker is dribbling right at you. Stay calm, and <b>don\'t dive in</b>. That means don\'t rush in and kick at the ball.',
              dribble: { who: 'away:M1', to: [-5, -10] }, dur: 1.2 },
            { say: 'Get close, about an arm\'s length away. Stand <b>sideways</b> with your knees bent. Now you can move either way.',
              move: { LD: [-7.4, -9] }, think: { LD: 'Patient... patient...' }, dur: 0.9 },
            { say: 'Now <b>make her go toward the sideline</b>. Stand a little closer to the middle than she is. Then her only way forward is along the sideline, away from our goal.',
              dribble: { who: 'away:M1', to: [-8.5, -14], dur: 1.6 }, move: { LD: [-9.6, -12.4] }, arrows: [[[-5, -10], [-9, -15], 'run', 0.1, YEL]], dur: 1.6 },
            { say: 'The sideline is like an extra defender. When she kicks the ball too far ahead, <b>jump in</b> and win it!',
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
            { say: 'We lost the ball, and they\'re running at our goal. If they got past you, don\'t walk. <b>Sprint back!</b>',
              dribble: { who: 'away:M1', to: [-4, -6] }, dur: 1.4 },
            { say: 'But where to? <b>Not</b> straight at the ball. Run toward <b>our goal</b>. Then you end up between the ball and our goal.',
              arrows: [['LW', [-6, -7], 'run', 0, BAD], ['LW', [-11, -2], 'run', 0, GOOD]], notes: [[[-4, -10], 'Chasing the ball', 'bad'], [[-11, 2], 'Toward our goal', 'good']] },
            { say: 'That\'s a <b>recovery run</b>: a sprint back to help!',
              move: { LW: [-10, -3.5], CM: [-7, 1] }, dribble: { who: 'away:M1', to: [-7, -7], dur: 2 }, dur: 2 },
            { say: 'Now you\'re back between the ball and our goal. The team is safe again. Sprinting back is a big part of being a great teammate.',
              rings: { LW: GOOD } }
          ]
        }
      ]
    }
  ];
})();
