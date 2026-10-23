/* Pitch IQ — Daily Challenge: five moments, the same all day, with a day streak.
   Coins and streak count once a day; replays are practice. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};

  function todaysPlan() {
    var key = PIQ.dayKey(new Date());
    var seed = 0;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    var rnd = PIQ.seeded(seed);
    var kinds = ['quiz', 'spoton', 'mistake', 'decide', 'quiz'];
    for (var j = kinds.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var t = kinds[j]; kinds[j] = kinds[k]; kinds[k] = t; }
    var used = {};
    return kinds.map(function (kind) { return PIQ.Moments.pick(kind, 'any', used, rnd); });
  }

  PIQ.dailyState = function () {
    var prof = PIQ.profile();
    prof.daily = prof.daily || { last: '', streak: 0, best: 0, days: 0, score: 0 };
    var d = prof.daily;
    // a streak only survives if yesterday (or today) was played
    var today = PIQ.dayKey(new Date()), yest = PIQ.dayKey(new Date(Date.now() - 864e5));
    d.live = d.last === today || d.last === yest ? d.streak : 0;
    d.doneToday = d.last === today;
    return d;
  };

  PIQ.GAMES.daily = {
    start: function (App, back) {
      var stage = App.stage();
      var I = App.ICONS;
      var d = PIQ.dailyState();
      var practice = d.doneToday;
      var plan = todaysPlan();
      var n = 0, best = 0;

      App.leave();
      App.setCurrent({ destroy: function () {} });
      App.topbar('Daily Challenge', back, '<span class="chip" id="dy-prog">' + plan.map(function () { return '<span class="pip"></span>'; }).join('') + '</span>');
      var s = App.sheet('', 'mini');

      PIQ.buildScene(stage, { home: PIQ.SHAPES.midBall, away: PIQ.SHAPES.midBallAway, ball: 'CM', camera: { target: [0, 0], dist: 46, theta: 0.6, phi: 1.0, portraitDist: 70, portraitTheta: 0.6 } }, { instantCamera: true });
      stage.autoSpin = 0.05;
      stage.after(0.6, function () { PIQ.chat(stage, 'dailyStart', null, 3.5); });
      s.innerHTML = '<div class="eyebrow">' + (practice ? 'Already done today' : 'Today\'s challenge') + '</div><h2>Five quick moments</h2>' +
        '<p>' + (practice ? 'You\'ve finished today\'s challenge. Play it again for practice, or come back tomorrow for a new one.' :
          'A new mix every day. Finish it to earn coins and keep your streak going.') + '</p>' +
        '<p class="small">Day streak: <b>' + d.live + '</b> &middot; Best: ' + d.best + '</p>' +
        '<div class="row end"><button class="btn" id="dy-go">' + (practice ? 'Practise' : 'Start') + ' ' + I.next + '</button></div>';
      s._fit();
      var go = function () { PIQ.sfx.tap(); next(); };
      s.querySelector('#dy-go').onclick = go;
      stage.on('enter', go);

      function pip(i, cls) {
        var p = document.querySelectorAll('#dy-prog .pip')[i];
        if (p) p.className = 'pip ' + cls;
      }

      function next() {
        if (n >= plan.length) return finish();
        var m = plan[n];
        pip(n, 'now');
        PIQ.Moments.run({ App: App, stage: stage, sheet: s, eyebrow: 'Challenge ' + (n + 1) + ' of ' + plan.length }, m, function (result, why) {
          if (result === 'best') { best++; stage.cheer(); }
          pip(n, result === 'best' ? 'good' : result === 'ok' ? 'ok' : 'bad');
          var foot = s.querySelector('#mm-foot');
          foot.innerHTML = (why ? '<div class="why">' + why + '</div>' : '') +
            '<div class="row end" style="margin-top:10px"><button class="btn" id="dy-next">' + (n < plan.length - 1 ? 'Next' : 'Finish') + ' ' + I.next + '</button></div>';
          s._fit();
          var go2 = function () { PIQ.sfx.tap(); n++; next(); };
          foot.querySelector('#dy-next').onclick = go2;
          stage.on('enter', go2);
        });
      }

      function finish() {
        stage.on('enter', null);
        var prof = PIQ.profile();
        var dd = prof.daily;
        var msg;
        if (!practice) {
          var today = PIQ.dayKey(new Date()), yest = PIQ.dayKey(new Date(Date.now() - 864e5));
          dd.streak = dd.last === yest ? dd.streak + 1 : 1;
          dd.best = Math.max(dd.best, dd.streak);
          dd.days++;
          dd.last = today;
          dd.score = best;
          PIQ.saveProfile();
          var xp = 30 + best * 6;
          PIQ.addXP(xp);
          PIQ.addCoins(20);
          PIQ.markDay();
          if (dd.streak >= 3) PIQ.award('daily3');
          if (dd.streak >= 7) PIQ.award('daily7');
          msg = '+' + xp + ' XP and ' + (xp + 20) + ' coins (with a 20-coin daily bonus).';
        } else msg = 'Practice round: no coins, but every answer counts for your brain!';
        PIQ.saveBest('daily', best);
        PIQ.sfx.cheer();
        App.bigmsg(best === plan.length ? 'Perfect day!' : 'Daily done!', 1600);
        PIQ.chat(stage, 'dailyDone', null, 4);
        s.innerHTML = '<div class="eyebrow">Daily Challenge</div><h2>' + best + ' / ' + plan.length + ' smart plays</h2>' +
          '<p>' + msg + '</p><p class="small">Day streak: <b>' + (practice ? dd.streak : dd.streak) + '</b> &middot; Best streak: ' + dd.best + '. A new challenge appears tomorrow.</p>' +
          '<div class="row"><button class="btn" id="dy-home">Home</button></div>';
        s._fit();
        s.querySelector('#dy-home').onclick = function () { PIQ.sfx.tap(); back(); };
      }
    }
  };
})();
