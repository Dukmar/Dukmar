/* Pitch IQ — game scenarios.
   SPOTON:   drag "YOU" to the right spot. target: {at,r} circle or {rect:[x1,z1,x2,z2]}; best: [x,z] ghost spot.
   MISTAKES: one player is out of position. wrong: id; fix: where she should be.
   DECISIONS: you have the ball; tap an option. grade: best | ok | bad. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var S = PIQ.SHAPES;
  var sh = PIQ.shape;
  var CAM_BACK = { target: [-13, 0], dist: 36, theta: 0.15, phi: 0.95 };

  PIQ.SPOTON = [
    { id: 'so1', title: 'Keeper\'s ball', you: 'RD', prompt: 'You\'re the <b>right back</b>. Our keeper just caught the ball. Where do you go?',
      scene: { home: S.gkBall, away: S.gkBallAway, ball: 'GK', camera: CAM_BACK }, youAt: [-21, 3],
      target: { rect: [-19, 7, -12, 15] }, best: [-16, 11], payoff: 'pass',
      explain: 'Split <b>wide</b>, near the edge of the box and close to the sideline. That stretches their team and gives the keeper a safe pass.' },
    { id: 'so2', title: 'Keeper\'s ball', you: 'CM', prompt: 'You\'re the <b>centre mid</b>. Our keeper has the ball. Where do you show for it?',
      scene: { home: S.gkBall, away: S.gkBallAway, ball: 'GK', camera: CAM_BACK }, youAt: [-3, 3],
      target: { rect: [-14, -3.5, -8.5, 4.5] }, best: [-11, 1], payoff: 'pass',
      explain: 'Drop into the <b>middle</b> in front of our defenders, between the retreat line and our box. Now the keeper has three passes to choose from.' },
    { id: 'so3', title: 'Keeper\'s ball', you: 'ST', prompt: 'You\'re the <b>striker</b>. Our keeper has the ball. Where should you be?',
      scene: { home: S.gkBall, away: S.gkBallAway, ball: 'GK', camera: 'broadcast' }, youAt: [-14, 4],
      target: { rect: [1, -6, 13, 6] }, best: [5, 0], payoff: 'none',
      explain: 'Stay <b>high</b>, in the middle. You push their defenders back and leave room for your teammates to build the attack.' },
    { id: 'so4', title: 'Ball in the middle', you: 'LW', prompt: 'You\'re the <b>left wing</b>. Our centre mid has the ball in the middle. Where do you go?',
      scene: { home: S.midBall, away: S.midBallAway, ball: 'CM', camera: 'broadcast' }, youAt: [1.5, -3],
      target: { rect: [3, -16.5, 13, -10] }, best: [7, -13], payoff: 'pass',
      explain: '<b>Wide and high</b>, near the left sideline. You stretch their defence and you\'re open for a pass.' },
    { id: 'so5', title: 'Ball in the middle', you: 'RD', prompt: 'You\'re the <b>right back</b>. Our centre mid has the ball. Where should you be?',
      scene: { home: S.midBall, away: S.midBallAway, ball: 'CM', camera: 'broadcast' }, youAt: [4, 6],
      target: { rect: [-14, 3, -5, 13] }, best: [-9, 8], payoff: 'none',
      explain: 'Step up, but <b>stay behind the ball</b>. If we lose it, you\'re already in a good spot to defend.' },
    { id: 'so6', title: 'In their end', you: 'LW', prompt: 'You\'re the <b>left wing</b>. Our right wing has the ball near their corner. Where do you run?',
      scene: { home: S.attBall, away: S.attBallAway, ball: 'RW', camera: { target: [13, 0], dist: 34, theta: 0.15, phi: 0.95 } }, youAt: [7, -13],
      target: { at: [19, -5.5], r: 3.2 }, best: [19, -5.5], payoff: 'goal',
      explain: 'Attack the <b>back post</b>, the far side of the goal. A pass across the goal finds you there.' },
    { id: 'so7', title: 'In their end', you: 'CM', prompt: 'You\'re the <b>centre mid</b>. Our right wing is near the corner. Where\'s your best spot?',
      scene: { home: S.attBall, away: S.attBallAway, ball: 'RW', camera: { target: [13, 0], dist: 34, theta: 0.15, phi: 0.95 } }, youAt: [17, 9.5],
      target: { at: [12, 1.5], r: 3.2 }, best: [12, 1.5], payoff: 'goal',
      explain: 'Wait near the <b>top of the box</b>. A pass rolled back to that spot is a great chance, and you\'re not crowding your winger.' },
    { id: 'so8', title: 'They have the ball', you: 'LW', prompt: 'You\'re the <b>left wing</b>. They have the ball on the far right. Where do you go?',
      scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: 'top' }, youAt: [7, -14],
      target: { at: [-3.5, -6], r: 3.6 }, best: [-4, -6], payoff: 'none',
      explain: 'You\'re on the <b>weak side</b>. Drop back and tuck in toward the middle to guard the space in front of our goal.' },
    { id: 'so9', title: 'They have the ball', you: 'RW', prompt: 'You\'re the <b>right wing</b>, the closest player. Where do you go to put pressure on?',
      scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: { target: [0, 5], dist: 30, theta: 0.15, phi: 0.95 } }, youAt: [9, 13],
      target: { at: [2.2, 7.4], r: 2.4 }, best: [2.2, 7.4], payoff: 'none',
      explain: 'Press from the <b>goal-side</b>: between the ball and our goal, a little toward the middle, so she has to go toward the sideline.' },
    { id: 'so10', title: 'They have the ball', you: 'RD', prompt: 'You\'re the <b>right back</b>. Our right wing is pressing. Where do you cover?',
      scene: { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: { target: [-4, 5], dist: 32, theta: 0.15, phi: 0.95 } }, youAt: [-14, 15],
      target: { at: [-4, 9], r: 3.2 }, best: [-4, 9], payoff: 'none',
      explain: '<b>Cover</b>: a few steps behind the presser, at an angle, ready if she gets beaten.' },
    { id: 'so11', title: 'Get open', you: 'LW', prompt: 'You\'re the <b>left wing</b>. A defender is blocking the pass from our centre mid. Get open!',
      scene: { home: { GK: [-18, 0], LD: [-9, -8], RD: [-9, 8], CM: [-2, 0], LW: [6, -7], RW: [7, 13], ST: [13, 0] }, away: { GK: [23, 0], D1: [14, -5], D2: [14, 5], M1: [3, -4.5], M2: [4, 2], M3: [6, 9], F: [-5, 2] }, ball: 'CM', camera: { target: [3, -4], dist: 30, theta: 0.15, phi: 0.95 } },
      youAt: [6, -7], target: { rect: [3, -16.5, 11, -10.5] }, best: [7, -12.5], payoff: 'pass',
      explain: 'A few steps toward the sideline opens a <b>clear passing lane</b>. No defender between you and the ball means you\'re open.' },
    { id: 'so12', title: 'Kick-in', you: 'CM', prompt: 'Our right wing is taking a <b>kick-in</b>. You\'re the <b>centre mid</b>. Where do you get open?',
      scene: { home: { GK: [-20, 0], LD: [-8, -10], RD: [-7, 9], CM: [1, 3], LW: [6, -12], RW: [3, 17.5], ST: [11, 1] }, away: { GK: [23, 0], D1: [12, -5], D2: [12, 5], M1: [3, -6], M2: [6, 4], M3: [6, 13.5], F: [-6, 2] }, ball: [3, 17.6], camera: { target: [2, 9], dist: 28, theta: 0.15, phi: 0.95 } },
      youAt: [1, 3], target: { at: [0, 12], r: 3 }, best: [0, 12], payoff: 'pass',
      explain: 'Come <b>toward the ball</b>, a short pass away, with no defender in the lane. Quick kick-ins catch the other team napping.' },
    { id: 'so13', title: 'Recovery run', you: 'LW', prompt: 'We lost the ball and they\'re attacking! You\'re the <b>left wing</b>. Where do you sprint back to?',
      scene: { home: { GK: [-22, 0], LD: [-11, -5], RD: [-11, 5], CM: [-6, 1], LW: [9, -10], RW: [10, 9], ST: [14, 0] }, away: { GK: [23, 0], D1: [12, -6], D2: [13, 4], M1: [-4, -6], M2: [-1, 3], M3: [3, 10], F: [-8, 1] }, ball: 'away:M1', camera: { target: [-3, -3], dist: 34, theta: 0.15, phi: 0.95 } },
      youAt: [9, -10], target: { at: [-10, -3], r: 4 }, best: [-10, -3], payoff: 'none',
      explain: 'Run back toward <b>our goal</b>, not at the ball, so you end up goal-side, between the ball and the net.' },
    { id: 'so14', title: 'Keeper angle', you: 'GK', prompt: 'You\'re the <b>keeper</b>. An attacker has the ball. Where do you stand?',
      scene: { home: { GK: [-24.5, 0], LD: [-17, 6], RD: [-12, 9], CM: [-6, 2] }, away: { F: [-14, -6], M2: [-6, -2] }, ball: 'away:F', camera: { target: [-19, -2], dist: 20, theta: 0.5, phi: 0.95 } },
      youAt: [-24.5, 2], target: { at: [-22.4, -1.45], r: 1.3 }, best: [-22.4, -1.45], payoff: 'none',
      explain: 'On the line between the ball and the <b>middle of the goal</b>, a few steps off your line. That makes the goal look small.' },
    { id: 'so15', title: 'Goal kick', you: 'LD', prompt: 'It\'s our <b>goal kick</b>. You\'re the <b>left back</b>. Where do you go?',
      scene: { home: { GK: [-22, -1.5], LD: [-20, -4], RD: [-16, 11], CM: [-11, 1], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] }, away: S.gkBallAway, ball: [-21, -1.5], camera: CAM_BACK },
      youAt: [-20, -4], target: { rect: [-19, -15, -12, -7] }, best: [-16, -11], payoff: 'pass',
      explain: 'Split <b>wide</b>, near the edge of the box. They have to stay behind the retreat line, so you\'ll have time on the ball.' }
  ];

  PIQ.MISTAKES = [
    { id: 'm1', prompt: 'Our keeper has the ball. Tap the player in the wrong spot.', scene: { home: sh('gkBall', { RD: [-21, 3.5] }), away: S.gkBallAway, ball: 'GK', camera: CAM_BACK },
      wrong: 'RD', fix: [-16, 11], explain: 'The <b>right back</b> is hiding next to the keeper. She should split wide so the keeper has an easy pass.' },
    { id: 'm2', prompt: 'Our centre mid has the ball. Who\'s out of position?', scene: { home: sh('midBall', { LW: [1.5, -2.5] }), away: S.midBallAway, ball: 'CM', camera: 'broadcast' },
      wrong: 'LW', fix: [7, -13], explain: 'The <b>left wing</b> is bunched right next to the ball. She should be wide and high to stretch their team.' },
    { id: 'm3', prompt: 'We\'re building an attack. Who\'s in the wrong place?', scene: { home: sh('midBall', { ST: [-5, 3] }), away: S.midBallAway, ball: 'CM', camera: 'broadcast' },
      wrong: 'ST', fix: [13, 0], explain: 'The <b>striker</b> dropped behind the ball. She should stay high to give us depth and push their defenders back.' },
    { id: 'm4', prompt: 'We\'re attacking in their end. Who isn\'t helping?', scene: { home: sh('attBall', { LD: [-18, -7] }), away: S.attBallAway, ball: 'RW', camera: 'broadcast' },
      wrong: 'LD', fix: [-2, -7], explain: 'The <b>left back</b> stayed back in our box. She should push up toward halfway to win the ball back if it gets cleared.' },
    { id: 'm5', prompt: 'They have the ball on our right. Who\'s out of position?', scene: { home: sh('defMid', { LW: [9, -14.5] }), away: S.defMidAway, ball: 'away:M1', camera: 'top' },
      wrong: 'LW', fix: [-4, -6], explain: 'The <b>left wing</b> is still wide and high on the weak side. She should tuck in and drop back to help defend.' },
    { id: 'm6', prompt: 'They have the ball. Who\'s on the wrong side?', scene: { home: sh('defMid', { RD: [7, 12] }), away: S.defMidAway, ball: 'away:M1', camera: 'top' },
      wrong: 'RD', fix: [-4, 9], explain: 'The <b>right back</b> is ahead of the ball, so she\'s not goal-side. She should be behind the presser, covering.' },
    { id: 'm7', prompt: 'They have the ball. Look carefully at the back. Who\'s wrong?', scene: { home: sh('defMid', { GK: [-24.8, -5.5] }), away: S.defMidAway, ball: 'away:M1', camera: { target: [-12, 2], dist: 34, theta: 0.15, phi: 0.95 } },
      wrong: 'GK', fix: [-20, 1.5], explain: 'The <b>keeper</b> is hugging the wrong post. She should be off her line, between the ball and the middle of the goal.' },
    { id: 'm8', prompt: 'Our keeper has the ball. Two players are in the same space. Who should move?', scene: { home: sh('gkBall', { LW: [-14.5, -13] }), away: S.gkBallAway, ball: 'GK', camera: CAM_BACK },
      wrong: 'LW', fix: [-3, -14], explain: 'The <b>left wing</b> came all the way back next to the left back. She should stay high and wide so we have someone to pass to up the field.' },
    { id: 'm9', prompt: 'It\'s our kick-off. Who\'s breaking the rules?', scene: { home: sh('kickoff', { LW: [3, -10] }), away: S.kickoffAway, ball: [0, 0], camera: 'broadcast' },
      wrong: 'LW', fix: [-2, -12], explain: 'At kick-off everyone starts in <b>their own half</b>. The left wing is already over the halfway line.' },
    { id: 'm10', prompt: 'We\'re attacking. Who\'s crowding the ball?', scene: { home: sh('attBall', { CM: [15.5, 9.5] }), away: S.attBallAway, ball: 'RW', camera: { target: [13, 2], dist: 32, theta: 0.15, phi: 0.95 } },
      wrong: 'CM', fix: [12, 2], explain: 'The <b>centre mid</b> ran right next to the winger, bringing her defender along. She should wait at the top of the box.' },
    { id: 'm11', prompt: 'They have the ball in the middle. Who left a big gap?', scene: { home: { GK: [-21, 0], LD: [-11, -15.5], RD: [-11, 4], CM: [-3, 0.5], LW: [-2, -7], RW: [-1.5, 6.5], ST: [4, 0.5] }, away: { GK: [23, 0], D1: [12, -6], D2: [12, 6], M1: [-2, -10], M2: [6, 1], M3: [-1, 9], F: [-9, -3] }, ball: 'away:M2', camera: 'top' },
      wrong: 'LD', fix: [-11, -4], explain: 'The <b>left back</b> is way out on the sideline. When they have the ball, squeeze in so there\'s no gap in front of our goal.' },
    { id: 'm12', prompt: 'It\'s our goal kick. Who should be showing for the ball?', scene: { home: { GK: [-22, -1.5], LD: [-16, -11], RD: [-16, 11], CM: [-1, 0], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] }, away: S.gkBallAway, ball: [-21, -1.5], camera: CAM_BACK },
      wrong: 'CM', fix: [-11, 1], explain: 'The <b>centre mid</b> is too far up the field. She should drop in front of our defenders to give the keeper a middle option.' }
  ];

  PIQ.DECISIONS = [
    { id: 'd1', you: 'CM', prompt: 'You have the ball outside their box. What\'s your best move?',
      scene: { home: { GK: [-16, 0], LD: [-4, -8], RD: [-4, 8], CM: [9, 1], LW: [13, -12], RW: [16, 11], ST: [18, -3] }, away: { GK: [23.5, 0], D1: [18.5, -1], D2: [19, 5], M1: [12, -7], M2: [12.5, 4], M3: [6, 10], F: [-4, 0] }, ball: 'CM', camera: { target: [14, 0], dist: 30, theta: 0.15, phi: 0.95 } },
      options: [
        { key: 'A', type: 'pass', to: 'RW', grade: 'best', why: 'Our right wing is open and closer to goal. Great pass!' },
        { key: 'B', type: 'shoot', grade: 'bad', why: 'Two defenders are blocking the way and you\'re far out. A shot here usually gets blocked.' },
        { key: 'C', type: 'dribble', to: [13, -2], grade: 'ok', why: 'There is a little space to dribble into, but the open winger was a better choice.' }
      ] },
    { id: 'd2', you: 'ST', prompt: 'You\'re in front of goal with the ball. The keeper is on the far post. What do you do?',
      scene: { home: { GK: [-12, 0], LD: [0, -7], RD: [2, 6], CM: [11, 2], LW: [16, -9], RW: [17, 11], ST: [18.5, 1] }, away: { GK: [24, 2.2], D1: [21, 5], D2: [15, -4], M1: [13, 7], M2: [9, -3], M3: [6, 9], F: [-3, 0] }, ball: 'ST', camera: { target: [18, 1], dist: 22, theta: 0.3, phi: 0.92 } },
      options: [
        { key: 'A', type: 'shoot', target: [25.6, -1.6], grade: 'best', why: 'You can see the goal and you\'re close. Shoot to the open side!' },
        { key: 'B', type: 'pass', to: 'CM', grade: 'ok', why: 'Safe, but you had a great chance to score yourself.' },
        { key: 'C', type: 'pass', to: 'LD', grade: 'bad', why: 'Passing all the way back wastes a great scoring chance.' }
      ] },
    { id: 'd3', you: 'LD', prompt: 'A defender is pressing you near our box. What\'s your best pass?',
      scene: { home: { GK: [-22, 0], LD: [-12, -10], RD: [-13, 8], CM: [-8, -3], LW: [-4, -15], RW: [2, 12], ST: [8, 0] }, away: { GK: [23, 0], D1: [10, -5], D2: [10, 5], M1: [-10, -8.5], M2: [-2, 1], M3: [-6.5, -14], F: [-14, 3] }, ball: 'LD', camera: { target: [-10, -6], dist: 26, theta: 0.15, phi: 0.95 } },
      options: [
        { key: 'A', type: 'pass', to: 'CM', grade: 'best', why: 'The centre mid is open and close. A short, safe pass keeps the ball.' },
        { key: 'B', type: 'pass', to: 'LW', grade: 'bad', why: 'A defender is standing right in that lane. It would likely get intercepted near our goal.' },
        { key: 'C', type: 'pass', to: 'GK', grade: 'ok', why: 'A back pass to the keeper is safe. The open centre mid was even better.' }
      ] },
    { id: 'd4', you: 'RW', prompt: 'You have the ball on the right. Nobody is in front of you. What do you do?',
      scene: { home: { GK: [-18, 0], LD: [-8, -8], RD: [-6, 9], CM: [2, 1], LW: [8, -12], RW: [7, 13], ST: [13, -1] }, away: { GK: [23, 0], D1: [16, -4], D2: [15, 3], M1: [6, -6], M2: [4, 3], M3: [3, 9], F: [-6, 0] }, ball: 'RW', camera: { target: [11, 8], dist: 30, theta: 0.15, phi: 0.95 } },
      options: [
        { key: 'A', type: 'dribble', to: [16, 12.5], grade: 'best', why: 'Open space in front of you? Run with it! You\'ll be near their box in seconds.' },
        { key: 'B', type: 'pass', to: 'RD', grade: 'ok', why: 'Safe, but you had lots of space to attack.' },
        { key: 'C', type: 'shoot', grade: 'bad', why: 'You\'re far out at a tight angle. Get closer first.' }
      ] },
    { id: 'd5', you: 'CM', prompt: 'Their team has crowded our right side. What\'s smart?',
      scene: { home: { GK: [-16, 0], LD: [-6, -8], RD: [-3, 9], CM: [2, 3], LW: [8, -13], RW: [7, 13], ST: [13, 4] }, away: { GK: [23, 0], D1: [13, -1], D2: [12, 8], M1: [8, 10], M2: [5, 6], M3: [9, 12.5], F: [-1, 5] }, ball: 'CM', camera: 'top' },
      options: [
        { key: 'A', type: 'pass', to: 'LW', grade: 'best', why: 'Switch! The left side is wide open.' },
        { key: 'B', type: 'pass', to: 'RW', grade: 'bad', why: 'Three defenders are around our right wing. That pass goes into the crowd.' },
        { key: 'C', type: 'dribble', to: [6, 6], grade: 'bad', why: 'Dribbling into the crowd usually loses the ball.' }
      ] },
    { id: 'd6', you: 'CM', prompt: 'You just won the ball! Their team was attacking. What now?',
      scene: { home: { GK: [-20, 0], LD: [-10, -7], RD: [-10, 7], CM: [-3, 1.3], LW: [0, -12], RW: [1, 11], ST: [10, -4] }, away: { GK: [23, 0], D1: [6, -7], D2: [9, 3], M1: [-6, -5], M2: [-1.5, 2.5], M3: [-5, 9], F: [-13, 0] }, ball: 'CM', camera: { target: [3, -1], dist: 34, theta: 0.15, phi: 0.95 } },
      options: [
        { key: 'A', type: 'pass', to: [15, -5], runner: 'ST', grade: 'best', why: 'Look forward first! A pass into the space for our striker starts a counter-attack.' },
        { key: 'B', type: 'pass', to: 'GK', grade: 'ok', why: 'Safe, but their team was out of position. You missed a chance to attack fast.' },
        { key: 'C', type: 'dribble', to: [-4, 6], grade: 'bad', why: 'Dribbling sideways gives them time to get back.' }
      ] },
    { id: 'd7', you: 'RD', prompt: 'You\'re near our goal and a striker is right behind you. What\'s safest?',
      scene: { home: { GK: [-23, 0], LD: [-18, -8], RD: [-19, 10], CM: [-12, 2], LW: [-8, -13], RW: [-9, 15], ST: [0, 0] }, away: { GK: [23, 0], D1: [6, -6], D2: [6, 6], M1: [-12, -6], M2: [-14, 4], M3: [-6, 11], F: [-20.5, 8.5] }, ball: 'RD', camera: { target: [-16, 6], dist: 26, theta: 0.15, phi: 0.95 } },
      options: [
        { key: 'A', type: 'pass', to: 'RW', grade: 'best', why: 'Up the line to the winger, away from our goal. Safe and it starts an attack.' },
        { key: 'B', type: 'pass', to: 'LD', grade: 'bad', why: 'A pass across the front of our own goal is risky. If it\'s intercepted, they score.' },
        { key: 'C', type: 'clear', to: [-14, 18.5], grade: 'ok', why: 'Kicking it out is safe, but it gives them the ball. The winger was open.' }
      ] },
    { id: 'd8', you: 'LW', prompt: 'It\'s 2 v 1: you and our striker against one defender. What\'s best?',
      scene: { home: { GK: [-16, 0], LD: [-5, -8], RD: [-5, 8], CM: [3, 2], LW: [10, -11], RW: [9, 13], ST: [12.5, -4] }, away: { GK: [23, 0], D1: [12, -9.5], D2: [16, 6], M1: [5, -5], M2: [6, 5], M3: [8, 10], F: [-6, 0] }, ball: 'LW', camera: { target: [12, -7], dist: 26, theta: 0.15, phi: 0.92 } },
      options: [
        { key: 'A', type: 'pass', to: 'ST', grade: 'best', why: 'The defender came to you, so the striker is free. Pass and make your run!' },
        { key: 'B', type: 'dribble', to: [13, -11], grade: 'bad', why: 'You\'d be dribbling straight into the defender while your teammate is free.' },
        { key: 'C', type: 'shoot', grade: 'bad', why: 'Too far out and at a tight angle.' }
      ] },
    { id: 'd9', you: 'RW', prompt: 'You\'re taking a kick-in. What\'s the smart choice?',
      scene: { home: { GK: [-20, 0], LD: [-8, -10], RD: [-7, 9], CM: [1, 11.5], LW: [6, -12], RW: [3, 17.6], ST: [9, 9] }, away: { GK: [23, 0], D1: [12, -5], D2: [9.5, 10], M1: [3, -6], M2: [6, 4], M3: [6.5, 14.5], F: [-6, 2] }, ball: 'RW', camera: { target: [3, 11], dist: 26, theta: 0.15, phi: 0.95 } },
      options: [
        { key: 'A', type: 'pass', to: 'CM', grade: 'best', why: 'She came toward you and nobody is in the lane. Quick and simple!' },
        { key: 'B', type: 'pass', to: 'ST', grade: 'bad', why: 'A defender is right on our striker. That pass would likely be stolen.' },
        { key: 'C', type: 'dribble', to: [6, 16], grade: 'ok', why: 'You can dribble it in, but a defender is close. The open pass was easier.' }
      ] },
    { id: 'd10', you: 'GK', prompt: 'You made a save. They\'re behind the retreat line. Where does the ball go?',
      scene: { home: S.gkBall, away: { GK: [23, 0], D1: [8, -6], D2: [8, 6], M1: [-5, -9], M2: [-9, 1.5], M3: [-5, 9], F: [-7, 0] }, ball: 'GK', camera: CAM_BACK },
      options: [
        { key: 'A', type: 'pass', to: 'LD', grade: 'best', why: 'Rolled out wide to a defender: safe, easy to control, away from danger.' },
        { key: 'B', type: 'pass', to: 'CM', grade: 'bad', why: 'An opponent is right near our centre mid. Losing it in the middle in front of our goal is dangerous.' },
        { key: 'C', type: 'punt', to: [10, 0], grade: 'ok', why: 'Some leagues allow punts, but a long kick is often a 50/50 ball. A roll keeps it.' }
      ] }
  ];
})();
