/* Pitch IQ — Spot On: drag "YOU" to the right spot. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};

  function zoneGap(t, p) {
    if (t.rect) {
      var r = t.rect;
      var x1 = Math.min(r[0], r[2]), x2 = Math.max(r[0], r[2]), z1 = Math.min(r[1], r[3]), z2 = Math.max(r[1], r[3]);
      var dx = Math.max(x1 - p[0], 0, p[0] - x2), dz = Math.max(z1 - p[1], 0, p[1] - z2);
      return Math.sqrt(dx * dx + dz * dz);
    }
    return Math.max(0, PIQ.dist(p, t.at) - t.r);
  }
  PIQ.zoneGap = zoneGap;

  PIQ.GAMES.spoton = {
    start: function (App, back) {
      var stage = App.stage();
      var prof = PIQ.profile();
      prof.games.spotonStars = prof.games.spotonStars || {};
      // favour puzzles not yet mastered
      var pool = PIQ.shuffle(PIQ.SPOTON).sort(function (a, b) { return (prof.games.spotonStars[a.id] || 0) - (prof.games.spotonStars[b.id] || 0); });
      var round = PIQ.shuffle(pool.slice(0, 5));
      var idx = 0, total = 0;
      var I = App.ICONS;

      App.leave();
      App.setCurrent({ destroy: function () {} });
      App.topbar('Spot On', back, '<span class="chip" id="so-score">&#9733; <b>0</b></span>');
      var s = App.sheet('', 'mini');

      function scoreChip() { var c = document.getElementById('so-score'); if (c) c.innerHTML = '&#9733; <b>' + total + '</b> / ' + round.length * 3; }

      function play() {
        var sc = round[idx];
        PIQ.buildScene(stage, { home: sc.scene.home, away: sc.scene.away, ball: sc.scene.ball, you: sc.you, youAt: sc.youAt, camera: sc.scene.camera }, { instantCamera: true });
        stage.setDraggable([sc.you], true);
        var me = stage.players[sc.you];
        me.faceBall = true;
        // tapping the ground also moves you there (handy on small screens)
        stage.on('ground', function (g) { if (!locked) stage.moveTo(sc.you, g, 0.5); });
        var locked = false;
        s.innerHTML = '<div class="eyebrow">Puzzle ' + (idx + 1) + ' of ' + round.length + ' &middot; ' + sc.title + '</div>' +
          '<p class="caption">' + sc.prompt + '</p><p class="small">Drag yourself (or tap the field), then lock it in.</p>' +
          '<div class="row end"><button class="btn" id="so-lock">Lock it in</button></div>';
        s._fit();
        s.querySelector('#so-lock').onclick = function () {
          if (locked) return;
          locked = true;
          stage.setDraggable([sc.you], false);
          reveal(sc, me);
        };
      }

      function reveal(sc, me) {
        stage.finishAll();
        var gap = zoneGap(sc.target, me.pos);
        var stars = gap <= 0.01 ? 3 : gap <= 2.5 ? 2 : gap <= 6 ? 1 : 0;
        total += stars;
        scoreChip();
        var prev = prof.games.spotonStars[sc.id] || 0;
        if (stars > prev) prof.games.spotonStars[sc.id] = stars;
        PIQ.saveProfile();
        var mastered = Object.keys(prof.games.spotonStars).filter(function (k) { return prof.games.spotonStars[k] === 3; }).length;
        if (mastered >= 10) PIQ.award('spoton');

        if (sc.target.rect) stage.zone(sc.target.rect, null, { color: PIQ.COLORS.good, opacity: 0.25 });
        else stage.zone(sc.target.at, sc.target.r, { color: PIQ.COLORS.good, opacity: 0.25, pulse: true });
        stage.clearLabels(true);
        if (stars < 3) {
          stage.arrow(me.pos, sc.best, 'run', { color: PIQ.COLORS.good, startCut: 0.6, endCut: 0.2 });
          stage.label(sc.best, 'Best spot', 'good', { y: 0.4 });
        }
        if (stars >= 2) { PIQ.sfx.good(); App.bigmsg(stars === 3 ? 'Spot on!' : 'Close!'); }
        else if (stars === 1) PIQ.sfx.ok();
        else PIQ.sfx.bad();

        var words = ['Not quite.', 'Getting there.', 'Close!', 'Spot on!'][stars];
        s.innerHTML = '<div class="row between"><div class="eyebrow">' + words + '</div>' + App.stars(stars) + '</div>' +
          '<p class="caption">' + sc.explain + '</p>' +
          '<div class="row end"><button class="btn" id="so-next">' + (idx < round.length - 1 ? 'Next ' : 'Finish ') + I.next + '</button></div>';
        s._fit();

        // payoff: show why the spot matters
        var delay = stars >= 2 ? 0.3 : 1.6;
        if (stars < 2) stage.after(0.5, function () { stage.moveTo(sc.you, sc.best, 1.1); });
        if (sc.payoff === 'pass' || sc.payoff === 'goal') {
          stage.after(delay + 0.4, function () {
            if (!stage.ball.owner) {
              // loose ball at a restart: the nearest teammate takes it
              var near = null, nd = 3;
              stage.list.forEach(function (p) { if (p.team === 'home' && p.id !== sc.you) { var d = PIQ.dist(p.pos, stage.ball.pos); if (d < nd) { nd = d; near = p; } } });
              if (!near) return;
              stage.giveBall(near.id);
            }
            stage.kickBall(stage.ball.owner.id === sc.you ? sc.best : PIQ.pt(stage, sc.you), { owner: sc.you });
          });
        }
        if (sc.payoff === 'goal') {
          stage.after(delay + 1.9, function () {
            if (stage.ball.owner && stage.ball.owner.id === sc.you) stage.kickBall([25.6, (Math.random() - 0.5) * 2.4], { height: 0.4, dur: 0.6, onDone: function () { PIQ.sfx.cheer(); } });
          });
        }
        s.querySelector('#so-next').onclick = function () {
          PIQ.sfx.tap();
          idx++;
          if (idx < round.length) play(); else finish();
        };
      }

      function finish() {
        var max = round.length * 3;
        var best = PIQ.saveBest('spoton', total);
        PIQ.addXP(total * 4);
        PIQ.markDay();
        PIQ.sfx.cheer();
        stage.clearAnnotations(); stage.clearLabels();
        s.innerHTML = '<div class="eyebrow">Round done</div><h2>' + total + ' / ' + max + ' stars</h2>' +
          '<p class="small">' + (best ? 'New best! ' : '') + '+' + total * 4 + ' XP. ' + (total >= 12 ? 'You really know where to stand.' : 'Try the Academy unit "Where Do I Stand?" and play again.') + '</p>' +
          '<div class="row"><button class="btn ghost" id="so-back">Games</button><button class="btn" id="so-again">' + I.replay + ' Play again</button></div>';
        s._fit();
        s.querySelector('#so-again').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.spoton.start(App, back); };
        s.querySelector('#so-back').onclick = function () { PIQ.sfx.tap(); back(); };
      }

      scoreChip();
      play();
    }
  };
})();
