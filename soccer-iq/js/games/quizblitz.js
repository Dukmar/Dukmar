/* Pitch IQ — Quiz Blitz: 10 quick questions, streak bonus. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};
  var COUNT = 10;

  PIQ.GAMES.quizblitz = {
    start: function (App, back) {
      var stage = App.stage();
      var I = App.ICONS;
      // mix the topics: at most two questions from any one lesson
      var perLesson = {};
      var qs = PIQ.shuffle(PIQ.QUIZ).filter(function (q) {
        perLesson[q.lesson] = (perLesson[q.lesson] || 0) + 1;
        return perLesson[q.lesson] <= 2;
      }).slice(0, COUNT);
      var n = 0, right = 0, streak = 0, bestStreak = 0, pts = 0;

      App.leave();
      App.setCurrent({ destroy: function () {} });
      App.topbar('Quiz Blitz', back, '<span class="chip" id="qb-streak">Streak <b>0</b></span>');
      var s = App.sheet('', 'tall');
      var plain = { home: PIQ.SHAPES.midBall, away: PIQ.SHAPES.midBallAway, ball: 'CM', camera: { target: [0, 0], dist: 46, theta: 0.6, phi: 1.0, portraitDist: 70, portraitTheta: 0.6 } };

      function ask() {
        var q = qs[n];
        PIQ.buildScene(stage, q.scene || plain, { instantCamera: !q.scene });
        stage.autoSpin = q.scene ? 0 : 0.05;
        s.innerHTML = '<div class="row between"><div class="eyebrow">Question ' + (n + 1) + ' of ' + qs.length + '</div><span class="chip">' + pts + ' pts</span></div><div id="qb-box"></div>' +
          '<div class="row end" style="margin-top:12px"><button class="btn" id="qb-next" hidden>Next ' + I.next + '</button></div>';
        var box = s.querySelector('#qb-box');
        box._fit = s._fit;
        App.question(box, q, function (ok) {
          if (ok) {
            right++; streak++;
            pts += 10 + Math.min(streak - 1, 5) * 2;
            if (streak >= 3) App.bigmsg(streak + ' in a row!');
          } else streak = 0;
          bestStreak = Math.max(bestStreak, streak);
          if (streak >= 10) PIQ.award('quiz');
          document.getElementById('qb-streak').innerHTML = 'Streak <b>' + streak + '</b>';
          var nb = s.querySelector('#qb-next');
          nb.hidden = false;
          nb.innerHTML = n < qs.length - 1 ? 'Next ' + I.next : 'Finish ' + I.next;
          nb.onclick = function () { PIQ.sfx.tap(); n++; if (n < qs.length) ask(); else finish(); };
          s._fit();
        });
        s._fit();
      }

      function finish() {
        var best = PIQ.saveBest('quizblitz', pts);
        PIQ.addXP(right * 3);
        PIQ.markDay();
        PIQ.sfx.cheer();
        s.innerHTML = '<div class="eyebrow">Blitz done</div><h2>' + right + ' / ' + qs.length + ' right</h2>' +
          '<p>' + pts + ' points &middot; best streak ' + bestStreak + '</p>' +
          '<p class="small">' + (best ? 'New best score! ' : '') + '+' + right * 3 + ' XP. Every question links to an Academy lesson if you want to learn more.</p>' +
          '<div class="row"><button class="btn ghost" id="qb-back">Done</button><button class="btn" id="qb-again">' + I.replay + ' Play again</button></div>';
        s._fit();
        s.querySelector('#qb-again').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.quizblitz.start(App, back); };
        s.querySelector('#qb-back').onclick = function () { PIQ.sfx.tap(); back(); };
      }

      ask();
    }
  };
})();
