/* Pitch IQ — Tactics Board: drag anyone, pick a formation, and let
   "Auto shape" move both teams as the ball moves. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var F = PIQ.FIELD;
  var AWAY_KEYS = { GK: 'GK', LD: 'D1', RD: 'D2', CD: 'D3', LW: 'M1', LM: 'M1', CM: 'M2', RW: 'M3', RM: 'M3', ST: 'F' };

  // where a team "should" be, in its own frame (attacking +x), for a ball at b
  function autoShape(base, b, have) {
    var out = {};
    var roles = Object.keys(base);
    roles.forEach(function (r) {
      var x = base[r][0], z = base[r][1];
      if (r === 'GK') {
        if (have) out[r] = [-F.L / 2 + PIQ.clamp(3 + (b[0] + 25) * 0.2, 2.5, 10), b[1] * 0.12];
        else out[r] = PIQ.keeperIdeal(b);
        return;
      }
      var nx, nz;
      if (have) {
        nx = x + b[0] * 0.7;
        nz = z + b[1] * 0.25;
        if (r === 'ST') nx = Math.max(nx, b[0] + 4);
        if ((r === 'LD' || r === 'RD' || r === 'CD') && b[0] > -12) nx = Math.min(nx, b[0] - 4);
      } else {
        nx = x * 0.7 + b[0] * 0.6 - 5;
        nz = z * 0.6 + b[1] * 0.45;
        if (r === 'ST') nx = PIQ.clamp(b[0] + 4, -5, 15);
        else nx = Math.min(nx, b[0] - 1.5);
      }
      out[r] = [PIQ.clamp(nx, -F.L / 2 + 3, F.L / 2 - 2), PIQ.clamp(nz, -F.W / 2 + 1.2, F.W / 2 - 1.2)];
    });
    if (!have) {
      // nearest field player presses from the goal-side
      var best = null, bd = 1e9;
      roles.forEach(function (r) { if (r !== 'GK') { var d = PIQ.dist(out[r], b); if (d < bd) { bd = d; best = r; } } });
      var gx = -F.L / 2 - b[0], gz = -b[1], gl = Math.sqrt(gx * gx + gz * gz) || 1;
      if (best) out[best] = [b[0] + gx / gl * 1.8, b[1] + gz / gl * 1.8];
    }
    return out;
  }

  PIQ.Board = {
    start: function (App, back) {
      var stage = App.stage();
      var I = App.ICONS;
      var cfg = { form: '2-3-1', have: true, auto: true, opp: true, draw: false };
      var selected = null, preview = null, p0 = null, lastAuto = 0;

      App.leave();
      App.setCurrent({ destroy: function () {} });
      App.topbar('Tactics Board', back);
      App.camDock(null);

      function homeBase() { return PIQ.FORMATIONS[cfg.form].shape; }
      function awayBase() {
        var b = PIQ.FORMATIONS['2-3-1'].shape, o = {};
        Object.keys(b).forEach(function (r) { o[AWAY_KEYS[r]] = b[r]; });
        return o;
      }
      function mirror(p) { return [-p[0], -p[1]]; }

      function setup() {
        var away = {};
        if (cfg.opp) {
          var ab = awayBase();
          Object.keys(ab).forEach(function (k) { away[k] = mirror(ab[k]); });
        }
        var cam = stage.lastPreset || 'broadcast';
        PIQ.buildScene(stage, { home: homeBase(), away: away, ball: [0, 0], camera: cam }, { keepCamera: true });
        var ids = stage.list.map(function (p) { return p.id; });
        stage.setDraggable(ids.concat(['ball']), true);
        stage.on('pick', function (p) {
          if (p.isBall) return;
          if (selected) selected.ring.visible = false;
          selected = p;
          PIQ.setRing(p, PIQ.COLORS.info, true);
          var eyes = document.getElementById('bd-eyes');
          if (eyes) eyes.disabled = false;
        });
        stage.on('dragMove', function (o) {
          if (!o.isBall || !cfg.auto) return;
          var now = Date.now();
          if (now - lastAuto < 140) return;
          lastAuto = now;
          applyAuto(0.7);
        });
        stage.on('dragEnd', function (o) { if (o.isBall && cfg.auto) applyAuto(0.7); });
        stage.on('groundDrag', cfg.draw ? drawHandler : null);
        if (cfg.auto) applyAuto(0.01);
      }

      function applyAuto(dur) {
        var b = stage.ball.pos;
        var h = autoShape(homeBase(), b, cfg.have);
        Object.keys(h).forEach(function (r) { if (stage.players[r]) stage.moveTo(r, h[r], dur); });
        if (cfg.opp) {
          var a = autoShape(awayBase(), mirror(b), !cfg.have);
          Object.keys(a).forEach(function (k) { if (stage.players['away:' + k]) stage.moveTo('away:' + k, mirror(a[k]), dur); });
        }
      }

      function drawHandler(g, phase, moved) {
        if (phase === 'start') { p0 = g; return; }
        if (!p0 || !g) return;
        if (preview) { stage.annot.remove(preview); preview = null; }
        if (PIQ.dist(p0, g) < 1) return;
        var a = stage.arrow(p0, g, 'run', { startCut: 0, endCut: 0 });
        if (phase === 'move') preview = a;
        else p0 = null;
      }

      var s = App.sheet(
        '<div class="toolbar" style="margin-bottom:8px">' +
          '<div class="seg" id="bd-form">' + Object.keys(PIQ.FORMATIONS).map(function (f) { return '<button data-f="' + f + '" class="' + (f === cfg.form ? 'on' : '') + '">' + f + '</button>'; }).join('') + '</div>' +
          '<div class="seg" id="bd-have"><button data-h="1" class="on">We have it</button><button data-h="0">They have it</button></div>' +
        '</div>' +
        '<div class="toolbar">' +
          '<button class="btn small chalk" id="bd-auto">Auto shape: on</button>' +
          '<button class="btn small ghost" id="bd-opp">Opponents: on</button>' +
          '<button class="btn small ghost" id="bd-draw">Draw runs: off</button>' +
          '<button class="btn small ghost" id="bd-eyes" disabled>' + I.eye + ' Her eyes</button>' +
          '<button class="btn small ghost" id="bd-clear">Clear runs</button>' +
          '<button class="btn small ghost" id="bd-reset">' + I.replay + ' Reset</button>' +
        '</div>' +
        '<p class="small" style="margin:10px 0 0">Drag any player or the ball. With <b>Auto shape</b> on, drag the ball and watch both teams move. Tap a player, then <b>Her eyes</b> to see what she sees. Spin and pinch the field to look around.</p>', 'mini');

      s.querySelector('#bd-form').onclick = function (e) {
        var b = e.target.closest ? e.target.closest('[data-f]') : null;
        if (!b) return;
        PIQ.sfx.tap();
        cfg.form = b.getAttribute('data-f');
        Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
        setup();
      };
      s.querySelector('#bd-have').onclick = function (e) {
        var b = e.target.closest ? e.target.closest('[data-h]') : null;
        if (!b) return;
        PIQ.sfx.tap();
        cfg.have = b.getAttribute('data-h') === '1';
        Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
        if (cfg.auto) applyAuto(0.9);
      };
      function toggle(id, key, label, onChange) {
        var b = s.querySelector(id);
        b.onclick = function () {
          PIQ.sfx.tap();
          cfg[key] = !cfg[key];
          b.textContent = label + ': ' + (cfg[key] ? 'on' : 'off');
          b.className = 'btn small ' + (cfg[key] ? 'chalk' : 'ghost');
          if (onChange) onChange();
        };
      }
      toggle('#bd-auto', 'auto', 'Auto shape', function () { if (cfg.auto) applyAuto(0.9); });
      toggle('#bd-opp', 'opp', 'Opponents', setup);
      toggle('#bd-draw', 'draw', 'Draw runs', function () { stage.on('groundDrag', cfg.draw ? drawHandler : null); });
      s.querySelector('#bd-draw').className = 'btn small ghost';
      s.querySelector('#bd-eyes').onclick = function () {
        if (!selected) return;
        PIQ.sfx.tap();
        if (stage.pov) stage.setCamera(stage.lastPreset || 'broadcast');
        else stage.setPOV(selected.id);
      };
      s.querySelector('#bd-clear').onclick = function () { PIQ.sfx.tap(); stage.clearAnnotations(); };
      s.querySelector('#bd-reset').onclick = function () { PIQ.sfx.tap(); selected = null; stage.setCamera('broadcast'); setup(); };

      stage.setCamera('broadcast');
      setup();
      PIQ.markDay();
    }
  };
})();
