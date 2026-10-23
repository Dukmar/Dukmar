/* Pitch IQ — Pass, Dribble or Shoot? You have the ball: pick an option. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.GAMES = PIQ.GAMES || {};
  var TIME = 14; // seconds per decision: generous, it's about thinking, not twitch speed

  function optLabel(o) {
    var R = PIQ.ROLES;
    if (o.type === 'shoot') return 'Shoot!';
    if (o.type === 'dribble') return 'Dribble into space';
    if (o.type === 'clear') return 'Kick it out of play';
    if (o.type === 'punt') return 'Kick it long';
    if (o.runner) return 'Pass into space for the ' + R[o.runner].name.toLowerCase();
    var who = R[o.to] ? R[o.to].name.toLowerCase() : 'teammate';
    return 'Pass to the ' + (o.to === 'GK' ? 'keeper' : who);
  }

  PIQ.GAMES.decide = {
    start: function (App, back) {
      var stage = App.stage();
      var round = PIQ.shuffle(PIQ.DECISIONS).slice(0, 6);
      var idx = 0, score = 0, streak = 0;
      var I = App.ICONS;
      var timerId = null;

      App.leave();
      App.setCurrent({ destroy: function () { if (timerId) clearInterval(timerId); } });
      App.topbar('Pass, Dribble or Shoot?', back, '<span class="chip" id="dc-score"><b>0</b> pts</span>');
      App.camDock(null);
      var timerBar = App.el('<div class="timer"><i style="width:100%"></i></div>');
      document.getElementById('ui').appendChild(timerBar);
      var s = App.sheet('', 'mini');

      function where(o) {
        if (o.type === 'shoot') return o.target ? [o.target[0] - 1.4, o.target[1]] : [23.6, 0];
        if (o.type === 'pass' && !o.runner) return PIQ.pt(stage, o.to);
        return o.to;
      }

      function play() {
        var sc = round[idx];
        PIQ.buildScene(stage, { home: sc.scene.home, away: sc.scene.away, ball: sc.scene.ball, you: sc.you, camera: sc.scene.camera }, { instantCamera: true });
        var opts = PIQ.shuffle(sc.options).map(function (o, i) { var c = {}; for (var k in o) c[k] = o[k]; c.key = 'ABC'[i]; return c; });
        opts.forEach(function (o) {
          var w = where(o);
          if (o.type === 'dribble' || o.runner) stage.zone(w, 1.6, { color: PIQ.COLORS.zone, pulse: true });
          stage.label(o.type === 'pass' && !o.runner ? o.to : w, o.key, 'opt', o.type === 'pass' && !o.runner ? {} : { y: 0.8 });
        });
        var answered = false;
        stage.after(0.5, function () { PIQ.chat(stage, 'decideStart'); });
        s.innerHTML = '<div class="eyebrow">Decision ' + (idx + 1) + ' of ' + round.length + '</div><p class="caption">' + sc.prompt + '</p>' +
          '<div class="answers">' + opts.map(function (o) { return '<button class="answer" data-k="' + o.key + '"><span class="k">' + o.key + '</span><span>' + optLabel(o) + '</span></button>'; }).join('') + '</div>';
        s._fit();
        var t0 = Date.now();
        if (timerId) clearInterval(timerId);
        timerId = setInterval(function () {
          var left = 1 - (Date.now() - t0) / (TIME * 1000);
          timerBar.firstChild.style.width = Math.max(0, left * 100) + '%';
          if (left <= 0) { clearInterval(timerId); timerId = null; if (!answered) choose(null); }
        }, 100);
        s.querySelector('.answers').addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('.answer') : null;
          if (b) choose(opts.filter(function (o) { return o.key === b.getAttribute('data-k'); })[0]);
        });
        // tap the receiver or the space on the field too
        stage.on('pick', function (p) {
          var o = opts.filter(function (x) { return x.type === 'pass' && !x.runner && x.to === p.id; })[0];
          if (o) choose(o);
        });
        stage.on('ground', function (g) {
          var best = null, bd = 3;
          opts.forEach(function (o) { var d = PIQ.dist(g, where(o)); if (d < bd) { bd = d; best = o; } });
          if (best) choose(best);
        });

        function choose(o) {
          if (answered) return;
          answered = true;
          if (timerId) { clearInterval(timerId); timerId = null; }
          var secs = (Date.now() - t0) / 1000;
          var pts = 0;
          stage.clearLabels(true); stage.clearAnnotations();
          if (!o) {
            streak = 0;
            PIQ.sfx.bad();
            App.bigmsg('Too slow!');
            o = opts.filter(function (x) { return x.grade === 'best'; })[0];
            act(o);
            feedback(o, 0, 'Out of time! Here\'s the best choice.');
            return;
          }
          if (o.grade === 'best') { pts = 3 + (secs < 5 ? 1 : 0); streak++; PIQ.sfx.good(); App.bigmsg(secs < 5 ? 'Quick &amp; smart!' : 'Smart!'); }
          else if (o.grade === 'ok') { pts = 1; streak = 0; PIQ.sfx.ok(); }
          else { streak = 0; PIQ.sfx.bad(); }
          if (streak >= 5) PIQ.award('decider');
          score += pts;
          var speaker = o.type === 'pass' && !o.runner ? o.to : o.runner || null;
          stage.after(0.9, function () { PIQ.chat(stage, o.grade === 'best' ? 'decideBest' : o.grade === 'ok' ? 'decideOk' : 'decideBad', o.grade === 'bad' ? null : speaker); });
          if (o.grade === 'best') stage.after(0.9, function () { stage.cheer(); });
          document.getElementById('dc-score').innerHTML = '<b>' + score + '</b> pts';
          act(o);
          var bestO = opts.filter(function (x) { return x.grade === 'best'; })[0];
          feedback(o, pts, o.grade === 'best' ? '' : 'Best choice: <b>' + bestO.key + '. ' + optLabel(bestO) + '</b>.');
        }

        function act(o) {
          var you = stage.players[sc.you];
          var target = where(o);
          if (o.type === 'pass' && !o.runner) {
            stage.kickBall(PIQ.pt(stage, o.to), { owner: o.to });
          } else if (o.runner) {
            stage.kickBall(o.to, { dur: 1.1 });
            stage.moveTo(o.runner, o.to, 1.1);
            stage.after(1.15, function () { stage.giveBall(o.runner); });
          } else if (o.type === 'dribble') {
            stage.giveBall(sc.you); you.faceBall = false;
            stage.moveTo(sc.you, o.to, 1.4);
          } else if (o.type === 'shoot') {
            var aim = o.target || [25.6, (Math.random() - 0.5) * 3];
            var blocked = o.grade === 'bad';
            stage.kickBall(blocked ? target : aim, { height: blocked ? 0.2 : 0.5, dur: 0.7, onDone: function () { if (!blocked) PIQ.sfx.cheer(); } });
          } else {
            stage.kickBall(o.to, { height: 4, dur: 1.4 });
          }
          if (o.grade !== 'bad') {
            stage.zone(o.type === 'pass' && !o.runner ? PIQ.pt(stage, o.to) : target, 1.4, { color: PIQ.COLORS.good });
          }
        }

        function feedback(o, pts, extra) {
          s.innerHTML = '<div class="row between"><div class="eyebrow">' + (o.grade === 'best' ? 'Great choice' : o.grade === 'ok' ? 'Not bad' : 'Hmm') + '</div><span class="chip">+' + pts + '</span></div>' +
            '<p class="caption">' + o.why + (extra ? ' ' + extra : '') + '</p>' +
            '<div class="row end"><button class="btn" id="dc-next">' + (idx < round.length - 1 ? 'Next ' : 'Finish ') + I.next + '</button></div>';
          s._fit();
          s.querySelector('#dc-next').onclick = function () {
            PIQ.sfx.tap();
            idx++;
            if (idx < round.length) play(); else finish();
          };
        }
      }

      function finish() {
        timerBar.firstChild.style.width = '0%';
        var best = PIQ.saveBest('decide', score);
        PIQ.addXP(score * 2);
        PIQ.markDay();
        PIQ.sfx.cheer();
        stage.clearAnnotations(); stage.clearLabels();
        s.innerHTML = '<div class="eyebrow">Round done</div><h2>' + score + ' points</h2>' +
          '<p class="small">' + (best ? 'New best! ' : '') + '+' + score * 2 + ' XP. Best choices score 3, fast best choices score 4.</p>' +
          '<div class="row"><button class="btn ghost" id="dc-back">Games</button><button class="btn" id="dc-again">' + I.replay + ' Play again</button></div>';
        s._fit();
        s.querySelector('#dc-again').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.decide.start(App, back); };
        s.querySelector('#dc-back').onclick = function () { PIQ.sfx.tap(); back(); };
      }

      play();
    }
  };
})();
