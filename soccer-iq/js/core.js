/* Pitch IQ — core helpers: namespace, maths, storage, sound.
   Written in ES2017 with no modules so it runs from a double-clicked file
   and in older Safari (no optional chaining, no class fields). */
(function () {
  'use strict';
  var PIQ = (window.PIQ = window.PIQ || {});

  // ---------- small maths ----------
  PIQ.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PIQ.lerp = function (a, b, t) { return a + (b - a) * t; };
  PIQ.ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  PIQ.dist = function (a, b) { var dx = a[0] - b[0], dz = a[1] - b[1]; return Math.sqrt(dx * dx + dz * dz); };
  PIQ.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  PIQ.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  PIQ.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  // personalise a line: {name} / {NAME} = her name, {team} / {TEAM} = her team colour
  PIQ.fill = function (s) {
    var prof = PIQ.profile ? PIQ.profile() : {};
    var name = (prof && prof.name) || 'superstar';
    var team = PIQ.teamWord || 'blue';
    return String(s).replace(/\{name\}/g, name).replace(/\{NAME\}/g, name.toUpperCase())
      .replace(/\{team\}/g, team).replace(/\{TEAM\}/g, team.toUpperCase());
  };
  // a player says something (speech bubble that fades after a few seconds)
  PIQ.say = function (stage, id, text, secs) {
    if (!stage || !stage.players[id]) return null;
    return stage.label(id, PIQ.esc(PIQ.fill(text)), 'talk', { ttl: secs || 3.2 });
  };
  // distance from point p to segment ab (all [x,z])
  PIQ.segDist = function (p, a, b) {
    var abx = b[0] - a[0], abz = b[1] - a[1];
    var len2 = abx * abx + abz * abz || 1e-6;
    var t = PIQ.clamp(((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2, 0, 1);
    return PIQ.dist(p, [a[0] + abx * t, a[1] + abz * t]);
  };

  // a real keyboard is likely (Mac) rather than a phone or tablet
  PIQ.hasKeys = !('ontouchstart' in window) || window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // ---------- storage (per-device progress; never required) ----------
  var KEY = 'pitchiq.v1';
  PIQ.store = {
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    save: function (data) {
      try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
    }
  };

  // ---------- sound (synthesised, starts only after a tap) ----------
  var ctx = null;
  var muted = false;
  function ac() {
    if (muted) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    var c = ac(); if (!c) return;
    var t0 = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, filterFreq, when, swell) {
    var c = ac(); if (!c) return;
    var t0 = c.currentTime + (when || 0);
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq || 1000; f.Q.value = 0.8;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + (swell ? dur * 0.4 : 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
  }
  PIQ.sfx = {
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
    unlock: function () { ac(); },
    whistle: function () {
      var c = ac(); if (!c) return;
      var t0 = c.currentTime;
      var o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 2900;
      lfo.frequency.value = 38; lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
      g.gain.setValueAtTime(0.12, t0 + 0.32);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(g); g.connect(c.destination);
      o.start(t0); lfo.start(t0); o.stop(t0 + 0.5); lfo.stop(t0 + 0.5);
    },
    kick: function () { noise(0.12, 0.35, 180); tone(110, 0.12, 'sine', 0.3, 0, 60); },
    tap: function () { tone(660, 0.07, 'triangle', 0.12); },
    good: function () { tone(660, 0.12, 'sine', 0.18); tone(880, 0.18, 'sine', 0.18, 0.1); tone(1320, 0.25, 'sine', 0.14, 0.2); },
    ok: function () { tone(520, 0.14, 'sine', 0.16); tone(660, 0.2, 'sine', 0.14, 0.12); },
    bad: function () { tone(220, 0.22, 'square', 0.08); tone(180, 0.28, 'square', 0.07, 0.15); },
    cheer: function () { if (PIQ.cheerHook) PIQ.cheerHook(); noise(1.6, 0.18, 1400, 0, true); noise(1.4, 0.12, 2600, 0.15, true); },
    levelUp: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.16, i * 0.11); }); }
  };
})();
