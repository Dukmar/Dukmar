/* Pitch IQ — Keeper Hero: move the keeper to the right angle before the shot. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};
  var F = PIQ.FIELD;
  var GX = -F.L / 2;          // our goal line
  var POST = F.goalW / 2;
  var SHOTS = 10;

  // the spot a keeper should take: on the ball-to-centre line, a few steps out
  function idealSpot(ball) {
    var dx = ball[0] - GX, dz = ball[1];
    var d = Math.sqrt(dx * dx + dz * dz);
    var out = PIQ.clamp(d * 0.25, 1.5, 3.5);
    return [GX + dx / d * out, dz / d * out];
  }
  PIQ.keeperIdeal = idealSpot;

  PIQ.GAMES.keeper = {
    start: function (App, back) {
      var stage = App.stage();
      var I = App.ICONS;
      var n = 0, saves = 0, phase = 'idle', alive = true;

      App.leave();
      App.setCurrent({ destroy: function () { alive = false; } });
      App.topbar('Keeper Hero', back, '<span class="chip" id="kp-score">Saves <b>0</b></span>');
      var s = App.sheet('<div class="eyebrow">You\'re the keeper</div><p class="caption">The attacker dribbles, then shoots. <b>Drag anywhere</b> on the field to move. Stand between the ball and the middle of the goal, a few steps off your line.</p>' +
        '<div class="row end"><button class="btn" id="kp-go">Start ' + I.next + '</button></div>', 'mini');

      PIQ.buildScene(stage, {
        home: { GK: [-24, 0], LD: [-16, -9], RD: [-15, 9] },
        away: { F: [-10, 4] },
        ball: 'away:F', you: 'GK',
        camera: { target: [-15, 0], dist: 20, theta: -Math.PI / 2 + 0.0001, phi: 1.0, portraitDist: 30, portraitTheta: -Math.PI / 2 }
      });
      var gk = stage.players.GK, att = stage.players['away:F'];
      gk.faceBall = true;
      var aim = { x: gk.pos[0], z: gk.pos[1] };
      function steer(g) {
        if (!g || phase === 'idle' || phase === 'done') return;
        aim.x = PIQ.clamp(g[0], GX + 0.3, GX + 10);
        aim.z = PIQ.clamp(g[1], -9, 9);
      }
      stage.on('groundDrag', function (g) { steer(g); });
      stage.on('ground', function (g) { steer(g); });

      // keeper chases the finger at a keeper's speed
      var lastT = Date.now();
      var speedTimer = setInterval(function () {
        if (!alive) { clearInterval(speedTimer); return; }
        var now = Date.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
        if (phase === 'idle' || phase === 'done') return;
        var dx = aim.x - gk.pos[0], dz = aim.z - gk.pos[1];
        var d = Math.sqrt(dx * dx + dz * dz);
        var max = 6.5 * dt;
        if (d > 0.02) {
          var k = Math.min(1, max / d);
          PIQ.setPlayerPos(gk, gk.pos[0] + dx * k, gk.pos[1] + dz * k);
          gk.speed = d > 0.1 ? 5 : 0; gk._dragSpeedT = 0.1;
          gk.heading = Math.atan2(dx, dz);
        }
      }, 16);

      function score() { var c = document.getElementById('kp-score'); if (c) c.innerHTML = 'Saves <b>' + saves + '</b> / ' + n; }

      function shot() {
        if (!alive) return;
        n++;
        phase = 'dribble';
        stage.clearAnnotations(); stage.clearLabels(true);
        var spot = [PIQ.lerp(-17, -9, Math.random()), (Math.random() * 2 - 1) * 11];
        if (Math.abs(spot[1]) > 7 && spot[0] < -14) spot[0] = -12;
        var speed = 3.6 + n * 0.35;
        var dur = Math.max(0.9, PIQ.dist(att.pos, spot) / speed);
        stage.giveBall('away:F');
        att.faceBall = false;
        stage.moveTo('away:F', spot, dur);
        s.innerHTML = '<div class="eyebrow">Shot ' + n + ' of ' + SHOTS + '</div><p class="caption">Get your angle right!</p>';
        s._fit();
        stage.after(dur + 0.55 - Math.min(0.3, n * 0.03), function () { take(spot); });
      }

      function take(ball) {
        if (!alive) return;
        phase = 'shot';
        // the shooter aims at the side the keeper leaves open
        var sides = [-POST + 0.35, POST - 0.35].map(function (z) {
          return { z: z, gap: PIQ.segDist(gk.pos, ball, [GX, z]) };
        }).sort(function (a, b) { return b.gap - a.gap; });
        var pick = Math.random() < 0.8 ? sides[0] : sides[1];
        var keeperOut = gk.pos[0] - GX;
        var chip = keeperOut > 7;
        var target = [GX - 0.6, pick.z];
        var gap = PIQ.segDist(gk.pos, ball, target);
        var saved = !chip && gap < 2.1; // forgiving reach: within ~0.5 m of the textbook spot saves about 9 in 10
        att.heading = Math.atan2(target[0] - att.pos[0], target[1] - att.pos[1]);
        att.obj.rotation.y = att.heading;
        stage._carryBall();
        var ideal = idealSpot(ball);
        var hit = saved ? [gk.pos[0] + (ball[0] - gk.pos[0]) * 0.08, gk.pos[1] + (ball[1] - gk.pos[1]) * 0.08] : target;
        stage.kickBall(hit, { height: chip ? 2.6 : 0.45, dur: chip ? 1 : 0.55, onDone: function () {
          if (!alive) return;
          phase = 'done';
          if (saved) {
            saves++;
            // a little dive toward the shot
            var side = PIQ.segDist([gk.pos[0], gk.pos[1] + 0.5], ball, target) < gap ? 1 : -1;
            gk.body.rotation.z = -side * 0.9;
            stage.after(0.7, function () { gk.body.rotation.z = 0; });
            stage.giveBall('GK');
            PIQ.sfx.good();
            App.bigmsg(PIQ.pick(['Save!', 'Great hands!', 'Denied!']));
          } else {
            PIQ.sfx.bad();
            App.bigmsg('Goal');
          }
          score();
          var off = PIQ.dist(gk.pos, ideal);
          stage.zone(ideal, 0.9, { color: PIQ.COLORS.good, pulse: true });
          stage.arrow(ball, [GX, -POST], 'pass', { color: PIQ.COLORS.bad, startCut: 0.5, endCut: 0 });
          stage.arrow(ball, [GX, POST], 'pass', { color: PIQ.COLORS.bad, startCut: 0.5, endCut: 0 });
          var tip = chip ? 'You came out too far and she chipped it over you. Stay a few steps off your line.'
            : saved ? (off < 1.2 ? 'Perfect angle!' : 'Saved! The green circle is the textbook spot.')
            : off > 1.2 ? 'The green circle shows the best spot: on the line from the ball to the middle of the goal.'
            : 'Good spot, but she found the corner. Keep your feet set before the shot!';
          s.innerHTML = '<div class="eyebrow">Shot ' + n + ' of ' + SHOTS + '</div><p class="caption">' + tip + '</p>' +
            '<div class="row end"><button class="btn" id="kp-next">' + (n < SHOTS ? 'Next shot ' : 'Finish ') + I.next + '</button></div>';
          s._fit();
          s.querySelector('#kp-next').onclick = function () {
            PIQ.sfx.tap();
            if (n < SHOTS) { reset(); shot(); } else finish();
          };
        } });
      }

      function reset() {
        stage.finishAll();
        var b = stage.ball.pos.slice();
        stage.giveBall('away:F');
        PIQ.setPlayerPos(att, b[0] > GX + 3 ? att.pos[0] : -10, att.pos[1]);
        PIQ.setPlayerPos(gk, GX + 1, 0);
        aim.x = GX + 1; aim.z = 0;
      }

      function finish() {
        phase = 'done';
        var best = PIQ.saveBest('keeper', saves);
        if (saves >= 8) PIQ.award('keeper');
        PIQ.addXP(saves * 4);
        PIQ.markDay();
        PIQ.sfx.cheer();
        s.innerHTML = '<div class="eyebrow">Game over</div><h2>' + saves + ' / ' + SHOTS + ' saves</h2>' +
          '<p class="small">' + (best ? 'New best! ' : '') + '+' + saves * 4 + ' XP. ' + (saves >= 8 ? 'A wall of hands!' : 'Tip: watch the ball, then get on the line to the middle of the goal.') + '</p>' +
          '<div class="row"><button class="btn ghost" id="kp-back">Games</button><button class="btn" id="kp-again">' + I.replay + ' Play again</button></div>';
        s._fit();
        s.querySelector('#kp-again').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.keeper.start(App, back); };
        s.querySelector('#kp-back').onclick = function () { PIQ.sfx.tap(); back(); };
      }

      s.querySelector('#kp-go').onclick = function () { PIQ.sfx.tap(); PIQ.sfx.whistle(); shot(); };
    }
  };
})();
