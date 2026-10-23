/* Pitch IQ — "moments": single challenges borrowed from every game, used by
   Match Day and the Daily Challenge. Each moment ends by calling
   done(result, why) with result 'best' | 'ok' | 'bad'. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var S = PIQ.SHAPES;
  var GX = -PIQ.FIELD.L / 2, POST = PIQ.FIELD.goalW / 2;

  var ATTACK_SCENE = { home: S.attBall, away: S.attBallAway, ball: 'RW', camera: { target: [12, 0], dist: 36, theta: 0.15, phi: 0.95 } };
  var DEFEND_SCENE = { home: S.defMid, away: S.defMidAway, ball: 'away:M1', camera: { target: [-6, 2], dist: 36, theta: 0.15, phi: 0.95 } };
  var ATTACK_LESSONS = /^(field|shape|attack|switch-1|restarts)/;
  var DEFEND_LESSONS = /^(defend|switch-2|keeper)/;
  var ATTACK_SPOTS = ['so1', 'so2', 'so4', 'so6', 'so7', 'so11', 'so12', 'so15'];
  var DEFEND_SPOTS = ['so8', 'so9', 'so10', 'so13', 'so14'];

  // a small seeded random so the Daily Challenge is the same all day
  PIQ.seeded = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function pickFrom(list, used, rnd) {
    var free = list.filter(function (x) { return !used[x.id]; });
    if (!free.length) free = list;
    var it = free[Math.floor((rnd || Math.random)() * free.length)];
    used[it.id] = true;
    return it;
  }

  // kind: quiz | decide | spoton | mistake | keeper ; side: attack | defend
  function pick(kind, side, used, rnd) {
    if (kind === 'quiz') {
      var re = side === 'attack' ? ATTACK_LESSONS : side === 'defend' ? DEFEND_LESSONS : /./;
      return { kind: kind, side: side, q: pickFrom(PIQ.QUIZ.filter(function (q) { return re.test(q.lesson); }), used, rnd) };
    }
    if (kind === 'decide') return { kind: kind, side: 'attack', sc: pickFrom(PIQ.DECISIONS, used, rnd) };
    if (kind === 'mistake') return { kind: kind, side: side, sc: pickFrom(PIQ.MISTAKES, used, rnd) };
    if (kind === 'spoton') {
      var ids = side === 'defend' ? DEFEND_SPOTS : side === 'attack' ? ATTACK_SPOTS : ATTACK_SPOTS.concat(DEFEND_SPOTS);
      return { kind: kind, side: side, sc: pickFrom(PIQ.SPOTON.filter(function (s) { return ids.indexOf(s.id) >= 0; }), used, rnd) };
    }
    var r = rnd || Math.random;
    return { kind: 'keeper', side: 'defend', id: 'k' + Math.floor(r() * 1e6), spot: [PIQ.lerp(-17, -10, r()), (r() * 2 - 1) * 10] };
  }

  function run(ctx, m, done) {
    var App = ctx.App, stage = ctx.stage, s = ctx.sheet, I = App.ICONS;
    var head = '<div class="eyebrow">' + ctx.eyebrow + '</div>';
    var finished = false;
    function finish(result, why) {
      if (finished) return;
      finished = true;
      stage.keyPlayer = null;
      stage.on('enter', null);
      done(result, why);
    }
    var keysHint = PIQ.hasKeys ? ' Arrow keys work too.' : '';

    if (m.kind === 'quiz') {
      PIQ.buildScene(stage, m.q.scene || (m.side === 'defend' ? DEFEND_SCENE : ATTACK_SCENE), { instantCamera: true });
      s.innerHTML = head + '<div id="mm-box"></div><div id="mm-foot"></div>';
      var box = s.querySelector('#mm-box');
      box._fit = s._fit;
      App.question(box, m.q, function (ok) { finish(ok ? 'best' : 'bad', ''); });
      s._fit();
      return;
    }

    if (m.kind === 'decide') {
      var sc = m.sc;
      PIQ.buildScene(stage, { home: sc.scene.home, away: sc.scene.away, ball: sc.scene.ball, you: sc.you, camera: sc.scene.camera }, { instantCamera: true });
      var where = function (o) {
        if (o.type === 'shoot') return o.target ? [o.target[0] - 1.4, o.target[1]] : [23.6, 0];
        if (o.type === 'pass' && !o.runner) return PIQ.pt(stage, o.to);
        return o.to;
      };
      var opts = PIQ.shuffle(sc.options).map(function (o, i) { var c = {}; for (var k in o) c[k] = o[k]; c.key = 'ABC'[i]; return c; });
      opts.forEach(function (o) {
        var w = where(o);
        if (o.type === 'dribble' || o.runner) stage.zone(w, 1.6, { color: PIQ.COLORS.zone, pulse: true });
        stage.label(o.type === 'pass' && !o.runner ? o.to : w, o.key, 'opt', o.type === 'pass' && !o.runner ? {} : { y: 0.8 });
      });
      s.innerHTML = head + '<p class="caption">' + sc.prompt + '</p><div class="answers">' +
        opts.map(function (o) { return '<button class="answer" data-k="' + o.key + '"><span class="k">' + o.key + '</span><span>' + PIQ.decideLabel(o) + '</span></button>'; }).join('') + '</div><div id="mm-foot"></div>';
      s._fit();
      var answers = s.querySelector('.answers');
      answers.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.answer') : null;
        if (!b || answers.classList.contains('locked')) return;
        answers.classList.add('locked');
        var o = opts.filter(function (x) { return x.key === b.getAttribute('data-k'); })[0];
        b.classList.add(o.grade === 'bad' ? 'wrong' : 'right');
        stage.clearLabels(true); stage.clearAnnotations();
        if (o.type === 'pass' && !o.runner) stage.kickBall(PIQ.pt(stage, o.to), { owner: o.to });
        else if (o.runner) { stage.kickBall(o.to, { dur: 1.1, owner: null }); stage.moveTo(o.runner, o.to, 1.1); stage.after(1.15, function () { stage.giveBall(o.runner); }); }
        else if (o.type === 'dribble') { stage.giveBall(sc.you); stage.moveTo(sc.you, o.to, 1.3); }
        else if (o.type !== 'shoot') stage.kickBall(o.to, { height: 4, dur: 1.3 });
        if (o.grade === 'best') PIQ.sfx.good(); else if (o.grade === 'ok') PIQ.sfx.ok(); else PIQ.sfx.bad();
        var bestO = opts.filter(function (x) { return x.grade === 'best'; })[0];
        stage.after(o.type === 'shoot' ? 0.1 : 1.4, function () {
          finish(o.type === 'shoot' && o.grade === 'best' ? 'best' : o.grade, o.why + (o.grade === 'best' ? '' : ' Best choice: <b>' + PIQ.decideLabel(bestO) + '</b>.'));
        });
      });
      return;
    }

    if (m.kind === 'spoton') {
      var so = m.sc;
      PIQ.buildScene(stage, { home: so.scene.home, away: so.scene.away, ball: so.scene.ball, you: so.you, youAt: so.youAt, camera: so.scene.camera }, { instantCamera: true });
      stage.setDraggable([so.you], true);
      stage.keyPlayer = so.you;
      var locked = false;
      stage.on('ground', function (g) { if (!locked) stage.moveTo(so.you, g, 0.5); });
      s.innerHTML = head + '<p class="caption">' + so.prompt + '</p><p class="small">Drag yourself or tap the field, then lock it in.' + keysHint + '</p>' +
        '<div class="row end"><button class="btn" id="mm-lock">Lock it in</button></div><div id="mm-foot"></div>';
      s._fit();
      var lock = function () {
        if (locked) return;
        locked = true;
        stage.setDraggable([so.you], false);
        stage.finishAll();
        var me = stage.players[so.you];
        var gap = PIQ.zoneGap(so.target, me.pos);
        var stars = gap <= 0.01 ? 3 : gap <= 2.5 ? 2 : gap <= 6 ? 1 : 0;
        if (so.target.rect) stage.zone(so.target.rect, null, { color: PIQ.COLORS.good, opacity: 0.25 });
        else stage.zone(so.target.at, so.target.r, { color: PIQ.COLORS.good, opacity: 0.25, pulse: true });
        if (stars < 3) stage.label(so.best, 'Best spot', 'good', { y: 0.4 });
        if (stars < 2) stage.moveTo(so.you, so.best, 1);
        if (stars >= 2) PIQ.sfx.good(); else PIQ.sfx.bad();
        var btn = s.querySelector('#mm-lock'); if (btn) btn.parentNode.removeChild(btn);
        // pass to her if she's in the spot (the match may then turn it into a goal)
        stage.after(stars >= 2 ? 0.3 : 1.2, function () {
          var owner = stage.ball.owner;
          if (owner && owner.id !== so.you && owner.team === 'home' && stars >= 2) stage.kickBall(PIQ.pt(stage, so.you), { owner: so.you });
        });
        stage.after(1.3, function () { finish(stars === 3 ? 'best' : stars === 2 ? 'ok' : 'bad', App.stars(stars) + ' ' + so.explain); });
      };
      s.querySelector('#mm-lock').onclick = lock;
      stage.on('enter', lock);
      return;
    }

    if (m.kind === 'mistake') {
      var mk = m.sc;
      PIQ.buildScene(stage, mk.scene, { instantCamera: true });
      s.innerHTML = head + '<p class="caption">' + PIQ.teamText(mk.prompt) + '</p><p class="small">Tap one of our players.</p><div id="mm-foot"></div>';
      s._fit();
      var answered = false;
      stage.on('pick', function (p) {
        if (answered || p.isBall) return;
        if (p.team !== 'home') { PIQ.toast('Look at <b>our</b> team: the ' + (PIQ.teamWord || 'blue') + ' shirts.'); return; }
        answered = true;
        var ok = p.id === mk.wrong;
        var w = stage.players[mk.wrong];
        PIQ.setRing(w, PIQ.COLORS.bad, true);
        if (ok) { PIQ.sfx.good(); PIQ.chat(stage, 'mistakeFound', mk.wrong, 3); }
        else { PIQ.sfx.bad(); PIQ.chat(stage, 'mistakeNotMe', p.id, 2.5); }
        stage.after(0.8, function () { stage.moveTo(mk.wrong, mk.fix, 1.2); });
        stage.after(2.1, function () { PIQ.setRing(w, PIQ.COLORS.good, true); finish(ok ? 'best' : 'bad', PIQ.teamText(mk.explain)); });
      });
      return;
    }

    // keeper: one shot, get your angle right first
    PIQ.buildScene(stage, {
      home: { GK: [GX + 1, 0], LD: [-16, -9], RD: [-15, 9] },
      away: { F: m.spot.slice() },
      ball: 'away:F', you: 'GK',
      camera: { target: [-15, 0], dist: 20, theta: -Math.PI / 2 + 0.0001, phi: 1.0, portraitDist: 30, portraitTheta: -Math.PI / 2 }
    }, { instantCamera: true });
    var gk = stage.players.GK;
    gk.faceBall = true;
    stage.keyPlayer = 'GK';
    var steer = function (g) {
      if (!g) return;
      stage.moveTo('GK', [PIQ.clamp(g[0], GX + 0.3, GX + 10), PIQ.clamp(g[1], -9, 9)], 0.35);
    };
    stage.on('groundDrag', steer);
    stage.on('ground', steer);
    s.innerHTML = head + '<p class="caption">You\'re the keeper. Stand between the ball and the middle of the goal, then tap <b>Ready</b>.</p><p class="small">Drag or tap on the field to move.' + keysHint + '</p>' +
      '<div class="row end"><button class="btn" id="mm-ready">Ready</button></div><div id="mm-foot"></div>';
    s._fit();
    var shoot = function () {
      var rb = s.querySelector('#mm-ready'); if (!rb) return;
      rb.parentNode.removeChild(rb);
      stage.keyPlayer = null;
      stage.on('groundDrag', null); stage.on('ground', null);
      stage.finishAll();
      var ball = stage.ball.pos.slice();
      var sides = [-POST + 0.35, POST - 0.35].map(function (z) { return { z: z, gap: PIQ.segDist(gk.pos, ball, [GX, z]) }; }).sort(function (a, b) { return b.gap - a.gap; });
      var target = [GX - 0.6, sides[0].z];
      var chip = gk.pos[0] - GX > 7;
      var gap = PIQ.segDist(gk.pos, ball, target);
      var saved = !chip && gap < 2.1;
      var ideal = PIQ.keeperIdeal(ball);
      var hit = saved ? [gk.pos[0] + (ball[0] - gk.pos[0]) * 0.08, gk.pos[1] + (ball[1] - gk.pos[1]) * 0.08] : target;
      stage.kickBall(hit, { height: chip ? 2.6 : 0.45, dur: chip ? 1 : 0.55, onDone: function () {
        stage.zone(ideal, 0.9, { color: PIQ.COLORS.good, pulse: true });
        if (saved) { stage.giveBall('GK'); gk.body.rotation.z = 0.8; stage.after(0.7, function () { gk.body.rotation.z = 0; }); }
        finish(saved ? 'best' : 'bad', saved ? 'Great spot! The green circle shows the very best spot.' : chip ? 'Too far out: she chipped it over you.' : 'The green circle shows the best spot: on the line from the ball to the middle of the goal.');
      } });
    };
    s.querySelector('#mm-ready').onclick = shoot;
    stage.on('enter', shoot);
  }

  // ---------- goals ----------
  function ourGoal(stage, cb) {
    stage.finishAll();
    var home = stage.list.filter(function (p) { return p.team === 'home' && p.role !== 'GK'; });
    var scorer = stage.players[stage.youId] && stage.youId !== 'GK' ? stage.players[stage.youId] : null;
    if (!scorer && stage.ball.owner && stage.ball.owner.team === 'home' && stage.ball.owner.role !== 'GK') scorer = stage.ball.owner;
    if (!scorer) scorer = home.sort(function (a, b) { return b.pos[0] - a.pos[0]; })[0];
    if (!scorer) { if (cb) cb(); return; }
    stage.ball.obj.visible = true;
    stage.giveBall(scorer.id);
    scorer.heading = Math.atan2(25 - scorer.pos[0], -scorer.pos[1] * 0.3);
    scorer.obj.rotation.y = scorer.heading;
    stage._carryBall();
    stage.after(0.35, function () {
      stage.kickBall([PIQ.FIELD.L / 2 + 0.6, (Math.random() - 0.5) * 3], { height: 0.5, dur: 0.75, onDone: function () {
        PIQ.sfx.cheer();
        stage.celebrate(scorer.id, PIQ.equipped().celebrate);
        PIQ.say(stage, scorer.id, PIQ.pick(['GOAL!', 'YES!', 'For you, {name}!', 'Get in!']), 2.5);
        if (cb) cb();
      } });
    });
  }
  function theirGoal(stage, cb) {
    stage.finishAll();
    var away = stage.list.filter(function (p) { return p.team === 'away' && p.role !== 'GK'; });
    var shooter = stage.ball.owner && stage.ball.owner.team === 'away' ? stage.ball.owner : away.sort(function (a, b) { return a.pos[0] - b.pos[0]; })[0];
    if (!shooter) { if (cb) cb(); return; }
    stage.ball.obj.visible = true;
    stage.giveBall(shooter.id);
    shooter.heading = Math.atan2(-25 - shooter.pos[0], -shooter.pos[1] * 0.3);
    shooter.obj.rotation.y = shooter.heading;
    stage._carryBall();
    stage.after(0.35, function () {
      stage.kickBall([-PIQ.FIELD.L / 2 - 0.6, (Math.random() - 0.5) * 3], { height: 0.5, dur: 0.75, onDone: function () {
        PIQ.sfx.bad();
        PIQ.chat(stage, 'keeperGoal', null, 2.5);
        if (cb) cb();
      } });
    });
  }

  PIQ.Moments = { pick: pick, run: run, ourGoal: ourGoal, theirGoal: theirGoal };
})();
