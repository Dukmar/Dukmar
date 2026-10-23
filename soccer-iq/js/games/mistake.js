/* Pitch IQ — Spot the Mistake: tap the teammate who is out of position. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};

  PIQ.GAMES.mistake = {
    start: function (App, back) {
      var stage = App.stage();
      var round = PIQ.shuffle(PIQ.MISTAKES).slice(0, 6);
      var idx = 0, score = 0;
      var I = App.ICONS;

      App.leave();
      App.setCurrent({ destroy: function () {} });
      App.topbar('Spot the Mistake', back, '<span class="chip" id="mk-score"><b>0</b> / ' + round.length + '</span>');
      App.camDock(null);
      var s = App.sheet('', 'mini');

      function play() {
        var sc = round[idx];
        PIQ.buildScene(stage, sc.scene, { instantCamera: true });
        var answered = false;
        stage.on('enter', null);
        s.innerHTML = '<div class="eyebrow">Scene ' + (idx + 1) + ' of ' + round.length + '</div>' +
          '<p class="caption">' + PIQ.teamText(sc.prompt) + '</p><p class="small">Tap one of our players. Spin the field with your finger to look around.</p>';
        s._fit();
        stage.on('pick', function (p) {
          if (answered || p.isBall) return;
          if (p.team !== 'home') { PIQ.toast('Look at <b>our</b> team: the ' + (PIQ.teamWord || 'blue') + ' shirts.'); return; }
          answered = true;
          var ok = p.id === sc.wrong;
          var w = stage.players[sc.wrong];
          if (ok) { score++; PIQ.sfx.good(); App.bigmsg('Found it!'); stage.cheer(); PIQ.chat(stage, 'mistakeFound', sc.wrong, 3.4); }
          else {
            PIQ.sfx.bad();
            PIQ.setRing(p, PIQ.COLORS.info, true);
            PIQ.chat(stage, 'mistakeNotMe', p.id, 3);
            stage.after(1, function () { PIQ.chat(stage, 'mistakeWas', sc.wrong, 3); });
          }
          document.getElementById('mk-score').innerHTML = '<b>' + score + '</b> / ' + round.length;
          PIQ.setRing(w, PIQ.COLORS.bad, true);
          stage.label(sc.wrong, 'Out of position', 'bad', { ttl: 1.2 });
          stage.after(1.2, function () {
            stage.arrow(w.pos, sc.fix, 'run', { color: PIQ.COLORS.good, startCut: 0.6, endCut: 0.2 });
            stage.moveTo(sc.wrong, sc.fix, 1.4);
          });
          stage.after(2.8, function () { PIQ.setRing(w, PIQ.COLORS.good, true); stage.label(sc.wrong, 'Fixed', 'good', { ttl: 3 }); });
          s.innerHTML = '<div class="eyebrow">' + (ok ? 'Yes!' : 'Not that one.') + '</div><p class="caption">' + PIQ.teamText(sc.explain) + '</p>' +
            '<div class="row end"><button class="btn" id="mk-next">' + (idx < round.length - 1 ? 'Next ' : 'Finish ') + I.next + '</button></div>';
          s._fit();
          stage.on('enter', function () { var b = document.getElementById('mk-next'); if (b) b.click(); });
          s.querySelector('#mk-next').onclick = function () {
            PIQ.sfx.tap();
            idx++;
            if (idx < round.length) play(); else finish();
          };
        });
      }

      function finish() {
        var best = PIQ.saveBest('mistake', score);
        if (score === round.length) PIQ.award('eagle');
        PIQ.addXP(score * 8);
        PIQ.markDay();
        PIQ.sfx.cheer();
        stage.clearAnnotations(); stage.clearLabels();
        s.innerHTML = '<div class="eyebrow">Round done</div><h2>' + score + ' / ' + round.length + ' found</h2>' +
          '<p class="small">' + (best ? 'New best! ' : '') + '+' + score * 8 + ' XP. ' + (score === round.length ? 'Eagle eyes!' : 'Coaches spot these in real games all the time. Keep looking!') + '</p>' +
          '<div class="row"><button class="btn ghost" id="mk-back">Games</button><button class="btn" id="mk-again">' + I.replay + ' Play again</button></div>';
        s._fit();
        s.querySelector('#mk-again').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.mistake.start(App, back); };
        s.querySelector('#mk-back').onclick = function () { PIQ.sfx.tap(); back(); };
      }

      play();
    }
  };
})();
