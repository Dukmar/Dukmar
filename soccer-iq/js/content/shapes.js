/* Pitch IQ — roles, formations and the scene builder.
   Pitch coordinates: x runs goal to goal (-25 is our goal, +25 is theirs), z runs across
   (-17 is our LEFT touchline, +17 is our RIGHT touchline, nearest the TV camera). */
(function () {
  'use strict';
  var PIQ = window.PIQ;

  PIQ.ROLES = {
    GK: { name: 'Keeper', short: 'GK', num: 1, job: 'Stops shots, talks to the team and starts our attacks.' },
    LD: { name: 'Left Back', short: 'LB', num: 3, job: 'Defends first. Stays goal-side, then gives a safe pass out wide.' },
    RD: { name: 'Right Back', short: 'RB', num: 2, job: 'Defends first. Stays goal-side, then gives a safe pass out wide.' },
    CD: { name: 'Centre Back', short: 'CB', num: 4, job: 'Guards the middle in front of the keeper.' },
    CM: { name: 'Centre Mid', short: 'CM', num: 8, job: 'Links defence to attack and supports the ball everywhere.' },
    LW: { name: 'Left Wing', short: 'LW', num: 11, job: 'Keeps the team wide on the left, attacks, then tracks back.' },
    RW: { name: 'Right Wing', short: 'RW', num: 7, job: 'Keeps the team wide on the right, attacks, then tracks back.' },
    LM: { name: 'Left Mid', short: 'LM', num: 6, job: 'Covers the left side of the middle, up and down.' },
    RM: { name: 'Right Mid', short: 'RM', num: 10, job: 'Covers the right side of the middle, up and down.' },
    ST: { name: 'Striker', short: 'ST', num: 9, job: 'Stays highest to stretch the other team, holds the ball up and scores.' }
  };
  PIQ.AWAY_NUMS = { GK: 1, D1: 2, D2: 3, D3: 5, M1: 6, M2: 8, M3: 10, F: 9, F2: 11 };

  // ---------- our 2-3-1 in each moment of the game ----------
  PIQ.SHAPES = {
    // our keeper has the ball (goal kick or after a save); they must be behind the retreat line
    gkBall: { GK: [-22, 0], LD: [-16, -11], RD: [-16, 11], CM: [-11, 1], LW: [-3, -14], RW: [-3, 14], ST: [5, 0] },
    gkBallAway: { GK: [23, 0], D1: [8, -6], D2: [8, 6], M1: [-5, -9], M2: [-3, 2], M3: [-5, 9], F: [-7, 0] },
    // ball with our centre mid in the middle of the field
    midBall: { GK: [-18, 0], LD: [-9, -8], RD: [-9, 8], CM: [0, 0], LW: [7, -13], RW: [7, 13], ST: [13, 0] },
    midBallAway: { GK: [23, 0], D1: [14, -5], D2: [14, 5], M1: [6, -8], M2: [3.5, 1.5], M3: [6, 8], F: [-4, -2] },
    // ball with our right wing in the attacking third
    attBall: { GK: [-13, 0], LD: [-2, -7], RD: [0, 6], CM: [12, 2], RW: [16, 12], ST: [20, 0], LW: [18, -7] },
    attBallAway: { GK: [23.5, 1.5], D1: [19, 6], D2: [20, -3], M1: [16.5, 9.5], M2: [13, -6], M3: [8, 4], F: [-3, 0] },
    // they have the ball in the middle, on our right side: press, cover, balance
    defMid: { GK: [-20, 1.5], LD: [-8, 0], RD: [-4, 9], CM: [-2, 3], LW: [-4, -6], RW: [2.2, 7.6], ST: [7, -1] },
    defMidAway: { GK: [23, 0], D1: [13, -7], D2: [12, 5], M1: [4, 8], M2: [3, -4], M3: [9, -12], F: [-9, 2] },
    // kick-off: everyone in their own half
    kickoff: { GK: [-23, 0], LD: [-13, -8], RD: [-13, 8], CM: [-6, 0], LW: [-2, -12], RW: [-2, 12], ST: [-0.6, 0.5] },
    kickoffAway: { GK: [23, 0], D1: [13, -8], D2: [13, 8], M1: [6, -10], M2: [6, 0], M3: [6, 10], F: [3, -3] }
  };

  PIQ.FORMATIONS = {
    '2-3-1': { roles: ['GK', 'LD', 'RD', 'LW', 'CM', 'RW', 'ST'], shape: PIQ.SHAPES.midBall },
    '3-2-1': { roles: ['GK', 'LD', 'CD', 'RD', 'LM', 'RM', 'ST'], shape: { GK: [-18, 0], LD: [-10, -10], CD: [-11, 0], RD: [-10, 10], LM: [1, -7], RM: [1, 7], ST: [12, 0] } },
    '2-1-2-1': { roles: ['GK', 'LD', 'RD', 'CM', 'LM', 'RM', 'ST'], shape: { GK: [-18, 0], LD: [-9, -9], RD: [-9, 9], CM: [-2, 0], LM: [6, -10], RM: [6, 10], ST: [13, 0] } }
  };

  function copy(o) { var r = {}; for (var k in o) r[k] = o[k].slice(); return r; }
  PIQ.copyShape = copy;
  // shape helper: base shape with some roles overridden
  PIQ.shape = function (name, overrides) {
    var s = copy(PIQ.SHAPES[name] || {});
    if (overrides) for (var k in overrides) {
      if (overrides[k] === null) delete s[k];
      else s[k] = overrides[k].slice();
    }
    return s;
  };

  PIQ.homeNumber = function (role) {
    var prof = PIQ.profile ? PIQ.profile() : null;
    return (PIQ.ROLES[role] && PIQ.ROLES[role].num) || 5;
  };

  // Build a scene on the stage from a spec:
  //   { home:{role:[x,z]}, away:{key:[x,z]}, ball:'CM' | 'away:M1' | [x,z], you:'LW', camera, youAt:[x,z] }
  PIQ.buildScene = function (stage, spec, opts) {
    opts = opts || {};
    stage.clear();
    var prof = PIQ.profile ? PIQ.profile() : { number: 10 };
    var youRole = spec.you || null;
    var used = {};
    var home = spec.home || {};
    if (youRole) used[prof.number] = youRole;
    Object.keys(home).forEach(function (role) {
      var num = PIQ.ROLES[role] ? PIQ.ROLES[role].num : 5;
      var isYou = role === youRole;
      if (isYou) num = prof.number;
      else if (youRole && num === prof.number) num = PIQ.ROLES[youRole] ? PIQ.ROLES[youRole].num : 99;
      var at = isYou && spec.youAt ? spec.youAt : home[role];
      stage.addPlayer({ id: role, team: 'home', role: role === 'GK' ? 'GK' : role, num: num, at: at, you: isYou && !opts.noYou, youLabel: opts.youLabel });
    });
    var away = spec.away || {};
    Object.keys(away).forEach(function (key) {
      stage.addPlayer({ id: 'away:' + key, team: 'away', role: key === 'GK' ? 'GK' : key, num: PIQ.AWAY_NUMS[key] || 7, at: away[key] });
    });
    var b = spec.ball;
    if (typeof b === 'string') {
      var owner = stage.players[b];
      if (owner) {
        // face the ball carrier toward the goal she is attacking
        owner.heading = owner.team === 'home' ? Math.PI / 2 : -Math.PI / 2;
        owner.obj.rotation.y = owner.heading;
        owner.faceBall = false;
        stage.giveBall(b);
        PIQ.setBallPos(stage.ball, owner.pos[0] + Math.sin(owner.heading) * 0.48, owner.pos[1] + Math.cos(owner.heading) * 0.48, 0);
      }
    } else if (b) stage.setBall(b);
    else stage.ball.obj.visible = false;
    if (spec.camera !== undefined || !opts.keepCamera) stage.setCamera(spec.camera || 'broadcast', !!opts.instantCamera);
    return stage;
  };

  // resolve a point reference: role id, 'away:X', 'ball', 'goal' / 'ourgoal', or [x,z]
  PIQ.pt = function (stage, ref) {
    if (!ref) return null;
    if (ref instanceof Array) return ref;
    if (ref === 'ball') return stage.ball.pos.slice();
    if (ref === 'goal') return [PIQ.FIELD.L / 2, 0];
    if (ref === 'ourgoal') return [-PIQ.FIELD.L / 2, 0];
    var p = stage.players[ref];
    return p ? p.pos.slice() : null;
  };
})();
