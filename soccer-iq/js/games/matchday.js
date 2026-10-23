/* Pitch IQ — Match Day: two halves of challenges against a rival team.
   Our chances: a smart answer scores. Their chances: a smart answer stops them.
   (Real U10 games in Ontario keep no score; this is the app's own game.) */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};

  var RIVALS = ['Thunder', 'Comets', 'Wildcats', 'Rockets', 'Hurricanes', 'Falcons', 'Lightning', 'Panthers'];
  // minute marks for the eight moments (two 25-minute halves)
  var MINUTES = [4, 11, 17, 23, 29, 36, 42, 48];
  var TIPS = [
    'Coach says: spread out when we have the ball, squeeze in when they do.',
    'Coach says: scan before the ball arrives. Look, then look again.',
    'Coach says: if you get beaten, sprint back toward our goal.',
    'Coach says: look forward first. Can we score? Can we pass forward?',
    'Coach says: talk to each other. Names first, short and loud.'
  ];

  PIQ.GAMES.matchday = {
    start: function (App, back) {
      var stage = App.stage();
      var I = App.ICONS;
      var prof = PIQ.profile();
      var rival = PIQ.pick(RIVALS);
      var used = {};
      // each half: our chance, their chance, our chance, their chance
      var attackKinds = PIQ.shuffle(['decide', 'spoton', 'quiz', 'decide']);
      var defendKinds = PIQ.shuffle(['mistake', 'keeper', 'quiz', 'spoton']);
      var plan = [];
      for (var i = 0; i < 4; i++) {
        plan.push(PIQ.Moments.pick(attackKinds[i], 'attack', used));
        plan.push(PIQ.Moments.pick(defendKinds[i], 'defend', used));
      }
      var n = 0, us = 0, them = 0, smart = 0;
      var team = (PIQ.teamWord || 'blue').toUpperCase();

      App.leave();
      App.setCurrent({ destroy: function () {} });
      App.topbar('Match Day', back);
      var sb = App.el('<div class="scoreboard" aria-live="polite"><span class="sb-team"><i style="background:' + hex(PIQ.TEAMS.home.shirt) + '"></i>' + PIQ.esc(team) + '</span>' +
        '<b id="sb-score">0 – 0</b><span class="sb-team">' + PIQ.esc(rival.toUpperCase()) + '<i style="background:' + hex(PIQ.TEAMS.away.shirt) + '"></i></span><span class="sb-min" id="sb-min">KO</span></div>');
      document.getElementById('ui').appendChild(sb);
      var s = App.sheet('', 'mini');

      function hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }
      function board(min) {
        document.getElementById('sb-score').textContent = us + ' – ' + them;
        document.getElementById('sb-min').textContent = min;
      }

      function intro() {
        PIQ.buildScene(stage, { home: PIQ.SHAPES.kickoff, away: PIQ.SHAPES.kickoffAway, ball: [0, 0], camera: { target: [0, 0], dist: 46, theta: 0.5, phi: 1.0, portraitDist: 70, portraitTheta: 0.5 } }, { instantCamera: true });
        stage.autoSpin = 0.05;
        stage.after(0.8, function () { PIQ.chat(stage, 'matchStart', null, 3.5); });
        s.innerHTML = '<div class="eyebrow">Match Day</div><h2>' + PIQ.esc(team) + ' vs ' + PIQ.esc(rival) + '</h2>' +
          '<p>Two halves, eight big moments. When it\'s <b>our chance</b>, a smart answer scores a goal. When <b>they attack</b>, a smart answer stops them.</p>' +
          '<div class="row end"><button class="btn" id="md-ko">Kick off ' + I.next + '</button></div>';
        s._fit();
        var go = function () { PIQ.sfx.tap(); PIQ.sfx.whistle(); next(); };
        s.querySelector('#md-ko').onclick = go;
        stage.on('enter', go);
      }

      var htDone = false;
      function next() {
        if (n === 4 && !htDone) return halftime();
        if (n >= plan.length) return fulltime();
        var m = plan[n];
        var min = MINUTES[n] + "'";
        board(min);
        var attack = m.side === 'attack';
        var ctx = { App: App, stage: stage, sheet: s, eyebrow: min + ' &middot; ' + (attack ? 'Our chance!' : 'Danger! ' + PIQ.esc(rival) + ' attack') };
        PIQ.Moments.run(ctx, m, function (result, why) {
          if (result === 'best') smart++;
          var scored = attack && (result === 'best' || (result === 'ok' && Math.random() < 0.5));
          var conceded = !attack && result === 'bad' && (m.kind === 'keeper' || Math.random() < 0.85);
          var foot = s.querySelector('#mm-foot');
          var verdict;
          if (scored) { us++; verdict = 'GOAL! ' + PIQ.esc(team) + ' score!'; }
          else if (attack) verdict = result === 'ok' ? 'Shot saved. So close!' : 'Chance gone.';
          else if (conceded) { them++; verdict = PIQ.esc(rival) + ' score.'; }
          else verdict = result === 'best' ? 'Stopped them! Great defending.' : 'Phew, they missed!';
          var after = function () {
            board(min);
            if (scored) App.bigmsg('GOAL!', 1600);
            else if (conceded) App.bigmsg(PIQ.esc(rival) + ' score', 1300);
            foot.innerHTML = (why ? '<div class="why">' + why + '</div>' : '') +
              '<div class="row between" style="margin-top:10px"><b class="verdict ' + (scored || (!attack && !conceded) ? 'good' : 'bad') + '">' + verdict + '</b>' +
              '<button class="btn" id="md-next">' + (n === 3 ? 'Half-time' : n === plan.length - 1 ? 'Full time' : 'Next') + ' ' + I.next + '</button></div>';
            s._fit();
            var go = function () { PIQ.sfx.tap(); n++; next(); };
            foot.querySelector('#md-next').onclick = go;
            stage.on('enter', go);
          };
          if (scored) PIQ.Moments.ourGoal(stage, after);
          else if (conceded && m.kind !== 'keeper') PIQ.Moments.theirGoal(stage, after);
          else { if (!attack && !conceded) stage.cheer(); after(); }
        });
      }

      function halftime() {
        board('HT');
        PIQ.sfx.whistle();
        stage.clearAnnotations(); stage.clearLabels(true);
        s.innerHTML = '<div class="eyebrow">Half-time</div><h2>' + PIQ.esc(team) + ' ' + us + ' – ' + them + ' ' + PIQ.esc(rival) + '</h2>' +
          '<p class="coachnote">' + PIQ.esc(PIQ.pick(TIPS)) + '</p>' +
          '<div class="row end"><button class="btn" id="md-2h">Second half ' + I.next + '</button></div>';
        s._fit();
        var go = function () { PIQ.sfx.tap(); PIQ.sfx.whistle(); htDone = true; next(); };
        s.querySelector('#md-2h').onclick = go;
        stage.on('enter', go);
      }

      function fulltime() {
        board('FT');
        PIQ.sfx.whistle();
        var result = us > them ? 'win' : us === them ? 'draw' : 'loss';
        var rec = prof.match = prof.match || { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, clean: 0, bestWin: 0 };
        rec.played++; rec.gf += us; rec.ga += them;
        if (result === 'win') { rec.won++; rec.bestWin = Math.max(rec.bestWin, us - them); }
        else if (result === 'draw') rec.drawn++; else rec.lost++;
        if (them === 0) rec.clean++;
        PIQ.saveProfile();
        PIQ.saveBest('matchday', us);
        if (result === 'win') PIQ.award('match');
        if (result === 'win' && them === 0) PIQ.award('clean');
        if (us >= 3) PIQ.award('hattrick');
        var xp = (result === 'win' ? 50 : result === 'draw' ? 30 : 20) + us * 5 + smart * 2;
        PIQ.addXP(xp);
        PIQ.markDay();
        if (result !== 'loss') PIQ.sfx.cheer();
        App.bigmsg(result === 'win' ? 'You win!' : result === 'draw' ? 'A draw!' : 'Good game!', 1800);
        stage.clearAnnotations(); stage.clearLabels(true);
        PIQ.chat(stage, result === 'win' ? 'matchWin' : result === 'draw' ? 'matchDraw' : 'matchLoss', null, 4);
        s.innerHTML = '<div class="eyebrow">Full time</div><h2>' + PIQ.esc(team) + ' ' + us + ' – ' + them + ' ' + PIQ.esc(rival) + '</h2>' +
          '<p>' + smart + ' of ' + plan.length + ' smart plays. +' + xp + ' XP and ' + xp + ' coins.</p>' +
          '<p class="small">Your record: ' + rec.won + ' won, ' + rec.drawn + ' drawn, ' + rec.lost + ' lost. ' + (result === 'loss' ? 'Every smart answer is a goal next time.' : '') + '</p>' +
          '<div class="row"><button class="btn ghost" id="md-home">Home</button><button class="btn" id="md-again">' + I.replay + ' Play another match</button></div>';
        s._fit();
        s.querySelector('#md-again').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.matchday.start(App, back); };
        s.querySelector('#md-home').onclick = function () { PIQ.sfx.tap(); back(); };
        stage.on('enter', null);
      }

      intro();
    }
  };
})();
