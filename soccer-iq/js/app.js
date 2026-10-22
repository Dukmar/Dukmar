/* Pitch IQ — app shell: screens, progress, XP, badges. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var esc = PIQ.esc;

  // ---------- icons (simple inline SVG) ----------
  var I = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8.5a5 5 0 0 1 0 7"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>',
    top: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/></svg>',
    goal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 19V7h18v12"/><path d="M3 11h18M3 15h18M8 7v12M12 7v12M16 7v12" stroke-width="1"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity=".2"/><path d="M10 8l6 4-6 4z"/></svg>',
    cone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4h4l4 14H6z"/><rect x="3" y="18" width="18" height="3" rx="1"/></svg>',
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.6" fill="currentColor"/><circle cx="15" cy="15" r="1.6" fill="currentColor"/><path d="M9.5 10.5l4 3" stroke-dasharray="2 2"/></svg>',
    whistle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="9" cy="14" r="6"/><path d="M13 9h8v4h-5"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z"/></svg>'
  };
  PIQ.ICONS = I;

  // ---------- progress ----------
  var DEFAULT = {
    name: '', number: 10, jersey: 'blue', xp: 0,
    lessons: {}, games: {}, badges: {}, days: [], settings: { sound: true, quality: 'high' }, seen: false
  };
  var state = PIQ.store.load() || {};
  for (var k in DEFAULT) if (state[k] === undefined) state[k] = JSON.parse(JSON.stringify(DEFAULT[k]));
  PIQ.profile = function () { return state; };
  function save() { PIQ.store.save(state); }
  PIQ.saveProfile = save;

  var LEVELS = [
    { xp: 0, name: 'Rookie' }, { xp: 100, name: 'Starter' }, { xp: 300, name: 'Playmaker' },
    { xp: 600, name: 'Captain' }, { xp: 1000, name: 'All-Star' }, { xp: 1600, name: 'Legend' }
  ];
  function levelOf(xp) {
    var i = 0;
    while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1].xp) i++;
    var cur = LEVELS[i], nxt = LEVELS[i + 1];
    return { i: i, name: cur.name, next: nxt ? nxt.name : null, pct: nxt ? (xp - cur.xp) / (nxt.xp - cur.xp) : 1, toNext: nxt ? nxt.xp - xp : 0 };
  }

  PIQ.BADGES = [
    { id: 'first', name: 'Kick-Off', d: 'Finish your first lesson.' },
    { id: 'shape', name: 'Shape Shifter', d: 'Finish "Where Do I Stand?"' },
    { id: 'attack', name: 'Playmaker', d: 'Finish "We Have the Ball".' },
    { id: 'defend', name: 'Brick Wall', d: 'Finish "They Have the Ball".' },
    { id: 'lead', name: 'Big Voice', d: 'Finish "Talk and Lead".' },
    { id: 'allLessons', name: 'Professor', d: 'Finish every lesson.' },
    { id: 'spoton', name: 'Spot On', d: '3 stars on 10 different Spot On puzzles.' },
    { id: 'eagle', name: 'Eagle Eye', d: 'A perfect Spot the Mistake round.' },
    { id: 'decider', name: 'Quick Thinker', d: '5 best decisions in a row.' },
    { id: 'keeper', name: 'Wall of Hands', d: '8 saves in one Keeper Hero game.' },
    { id: 'quiz', name: 'Quiz Whiz', d: 'A 10-answer streak in Quiz Blitz.' },
    { id: 'streak', name: 'On a Roll', d: 'Play on 3 different days.' }
  ];

  function toast(msg, ms) {
    var t = document.getElementById('toast');
    t.innerHTML = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }
  PIQ.toast = toast;

  PIQ.addXP = function (n) {
    if (!n) return;
    var before = levelOf(state.xp).i;
    state.xp += n;
    var after = levelOf(state.xp);
    save();
    if (after.i > before) {
      PIQ.sfx.levelUp();
      toast('Level up! You\'re a <b>' + esc(after.name) + '</b> now!', 3500);
    }
  };
  PIQ.award = function (id) {
    if (state.badges[id]) return;
    var b = PIQ.BADGES.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    state.badges[id] = Date.now();
    save();
    setTimeout(function () { PIQ.sfx.levelUp(); toast('New badge: <b>' + esc(b.name) + '</b>', 3500); }, 900);
  };
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function markDay() {
    var t = today();
    if (state.days.indexOf(t) < 0) { state.days.push(t); if (state.days.length > 60) state.days.shift(); save(); }
    if (state.days.length >= 3) PIQ.award('streak');
  }

  function applyJersey() {
    var j = PIQ.JERSEYS.filter(function (x) { return x.id === state.jersey; })[0] || PIQ.JERSEYS[0];
    PIQ.TEAMS.home.shirt = j.shirt; PIQ.TEAMS.home.socks = j.shirt; PIQ.TEAMS.home.shorts = j.shorts;
    PIQ.TEAMS.home.text = j.text || '#ffffff';
    PIQ.TEAMS.away.shirt = state.jersey === 'pink' ? 0xff8a1f : 0xe8453c;
    PIQ.TEAMS.home.keeper = state.jersey === 'teal' ? 0xffd23f : 0x19c37d;
    PIQ.TEAMS.away.keeper = state.jersey === 'black' || state.jersey === 'purple' ? 0xd7f24a : 0x2b2f3a;
    PIQ.TEAMS.away.socks = PIQ.TEAMS.away.shirt;
    PIQ.teamWord = j.label.toLowerCase();
  }
  PIQ.teamText = function (html) { return html.replace(/\bblue\b/g, PIQ.teamWord || 'blue'); };
  function hexCss(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  // ---------- UI helpers ----------
  var ui, stage, current = null;
  function clearUI() { ui.innerHTML = ''; }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  var App = {
    ICONS: I,
    el: el,
    stage: function () { return stage; },
    // leave whatever screen is running
    leave: function () {
      if (current && current.destroy) current.destroy();
      current = null;
      stage.speedScale = 1;
      stage.setInset(0, 0);
      clearUI();
    },
    setCurrent: function (obj) { current = obj; },
    topbar: function (title, onBack, extraHtml) {
      var bar = el('<div class="topbar">' +
        (onBack ? '<button class="iconbtn" id="tb-back" aria-label="Back">' + I.back + '</button>' : '') +
        '<div class="title">' + title + '</div><div class="spacer"></div>' + (extraHtml || '') +
        '<button class="iconbtn" id="tb-sound" aria-label="Sound">' + (state.settings.sound ? I.soundOn : I.soundOff) + '</button></div>');
      ui.appendChild(bar);
      if (onBack) bar.querySelector('#tb-back').onclick = function () { PIQ.sfx.tap(); onBack(); };
      var sb = bar.querySelector('#tb-sound');
      sb.onclick = function () {
        state.settings.sound = !state.settings.sound; save();
        PIQ.sfx.setMuted(!state.settings.sound);
        sb.innerHTML = state.settings.sound ? I.soundOn : I.soundOff;
        PIQ.sfx.tap();
      };
      return bar;
    },
    sheet: function (html, cls) {
      var s = el('<div class="sheet ' + (cls || '') + '">' + html + '</div>');
      ui.appendChild(s);
      App.fitInset(s);
      return s;
    },
    fitInset: function (s) {
      function fit() {
        if (!s.parentNode) return;
        var landscapePhone = window.innerHeight <= 520 && window.innerWidth > window.innerHeight;
        if (landscapePhone) stage.setInset(0, s.offsetWidth + 8);
        else stage.setInset(Math.min(s.offsetHeight, window.innerHeight * 0.6), 0);
      }
      fit();
      setTimeout(fit, 60);
      s._fit = fit;
    },
    // camera buttons; youId enables "her eyes"
    camDock: function (youId, extra) {
      var html = '<div class="camdock">' +
        '<button data-cam="broadcast" aria-label="TV view">' + I.tv + 'TV</button>' +
        '<button data-cam="top" aria-label="Top view">' + I.top + 'TOP</button>' +
        '<button data-cam="behind" aria-label="Behind the goal">' + I.goal + 'GOAL</button>' +
        (youId ? '<button data-cam="eyes" aria-label="Her eyes">' + I.eye + 'EYES</button>' : '') +
        (extra || '') + '</div>';
      var d = el(html);
      ui.appendChild(d);
      d.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button') : null;
        if (!b || !b.getAttribute('data-cam')) return;
        PIQ.sfx.tap();
        var c = b.getAttribute('data-cam');
        if (c === 'eyes') {
          if (stage.pov) stage.setCamera(stage.lastPreset || 'broadcast');
          else stage.setPOV(youId);
        } else stage.setCamera(c);
        Array.prototype.forEach.call(d.querySelectorAll('button[data-cam]'), function (x) { x.classList.toggle('on', x === b && !(c === 'eyes' && !stage.pov)); });
      });
      return d;
    },
    stars: function (n, max) {
      max = max || 3;
      var s = '<span class="stars" aria-label="' + n + ' of ' + max + ' stars">';
      for (var i = 0; i < max; i++) s += i < n ? '&#9733;' : '<span class="off">&#9733;</span>';
      return s + '</span>';
    },
    bigmsg: function (text, ms) {
      var m = el('<div class="bigmsg">' + text + '</div>');
      ui.appendChild(m);
      setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, ms || 1300);
    },
    // multiple-choice question; calls done(correct)
    question: function (container, q, done) {
      var order = PIQ.shuffle(q.a.map(function (a, i) { return i; }));
      var keys = 'ABCD';
      var html = '<p class="caption">' + PIQ.teamText(q.q) + '</p><div class="answers">' +
        order.map(function (idx, n) { return '<button class="answer" data-i="' + idx + '"><span class="k">' + keys[n] + '</span><span>' + esc(q.a[idx]) + '</span></button>'; }).join('') +
        '</div><div class="why" hidden></div>';
      container.innerHTML = html;
      var box = container.querySelector('.answers');
      box.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.answer') : null;
        if (!b || box.classList.contains('locked')) return;
        box.classList.add('locked');
        var i = +b.getAttribute('data-i');
        var ok = i === q.c;
        Array.prototype.forEach.call(box.children, function (x) {
          var xi = +x.getAttribute('data-i');
          if (xi === q.c) x.classList.add('right');
          else if (x === b) x.classList.add('wrong');
          else x.classList.add('dim');
        });
        if (ok) PIQ.sfx.good(); else PIQ.sfx.bad();
        var why = container.querySelector('.why');
        why.innerHTML = (ok ? '<b>Yes!</b> ' : '<b>Not quite.</b> ') + PIQ.teamText(q.why);
        why.hidden = false;
        if (container._fit) container._fit();
        done(ok);
      });
    },
    sceneFor: function (q) {
      if (q.scene) PIQ.buildScene(stage, q.scene, { instantCamera: false });
    }
  };
  PIQ.App = App;

  // ---------- ambient home scene ----------
  function ambient() {
    PIQ.buildScene(stage, { home: PIQ.SHAPES.midBall, away: PIQ.SHAPES.midBallAway, ball: 'CM', camera: { target: [0, 0], dist: 46, theta: 0.6, phi: 1.0, portraitDist: 70, portraitTheta: 0.6 } }, { instantCamera: true });
    stage.autoSpin = 0.04;
    var order = ['CM', 'LW', 'ST', 'RW', 'CM', 'RD', 'LD', 'CM'];
    var i = 0;
    var alive = true;
    function step() {
      if (!alive) return;
      i = (i + 1) % order.length;
      var to = order[i];
      if (stage.players[to] && stage.ball.owner && stage.ball.owner.id !== to) stage.kickBall(PIQ.pt(stage, to), { owner: to, silent: true });
      // drift the team shape a little so the scene breathes
      var base = PIQ.SHAPES.midBall;
      Object.keys(base).forEach(function (r) {
        if (r === to) return;
        var p = base[r];
        stage.moveTo(r, [p[0] + (Math.random() - 0.5) * 4, p[1] + (Math.random() - 0.5) * 4], 2.2);
      });
      stage.after(2.6, step);
    }
    stage.after(1.5, step);
    return { destroy: function () { alive = false; } };
  }

  // ---------- screens ----------
  var screens = {};

  screens.home = function () {
    App.leave();
    App.setCurrent(ambient());
    var lv = levelOf(state.xp);
    var done = Object.keys(state.lessons).length;
    var total = PIQ.UNITS.reduce(function (n, u) { return n + u.lessons.length; }, 0);
    var j = PIQ.JERSEYS.filter(function (x) { return x.id === state.jersey; })[0] || PIQ.JERSEYS[0];
    var name = state.name || 'Tap to add your name';
    var h = el('<div class="home">' +
      '<div class="logo"><div class="word">Pitch <span>IQ</span></div><div class="tag">soccer smarts for 7v7</div></div>' +
      '<button class="playercard" id="h-profile"><div class="shirt" style="background:' + hexCss(j.shirt) + ';color:' + (j.text || '#fff') + '">' + state.number + '</div>' +
      '<div class="who"><div class="name">' + esc(name) + '</div><div class="lvl">' + esc(lv.name) + ' &middot; ' + state.xp + ' XP' + (lv.next ? ' &middot; ' + lv.toNext + ' to ' + esc(lv.next) : '') + '</div><div class="bar"><i style="width:' + Math.round(lv.pct * 100) + '%"></i></div></div></button>' +
      '<div class="tiles">' +
        '<button class="tile hero" id="h-learn"><div class="row between"><span class="t">Academy</span>' + I.book + '</div><span class="s">Animated lessons: positions, attacking, defending, restarts. ' + done + ' of ' + total + ' done.</span></button>' +
        '<button class="tile" id="h-games">' + I.play + '<div><div class="t">Games</div><div class="s">Spot On, Keeper Hero and more</div></div></button>' +
        '<button class="tile yellow" id="h-quiz">' + I.whistle + '<div><div class="t">Quiz Blitz</div><div class="s">Quick-fire questions</div></div></button>' +
        '<button class="tile green" id="h-board">' + I.board + '<div><div class="t">Tactics Board</div><div class="s">Move players in 3D</div></div></button>' +
        '<button class="tile green" id="h-rules">' + I.cone + '<div><div class="t">7v7 Rules</div><div class="s">Halton / Ontario</div></div></button>' +
      '</div></div>');
    ui.appendChild(h);
    App.topbar('', null);
    h.querySelector('#h-profile').onclick = function () { PIQ.sfx.tap(); screens.profile(); };
    h.querySelector('#h-learn').onclick = function () { PIQ.sfx.tap(); screens.academy(); };
    h.querySelector('#h-games').onclick = function () { PIQ.sfx.tap(); screens.games(); };
    h.querySelector('#h-quiz').onclick = function () { PIQ.sfx.tap(); PIQ.GAMES.quizblitz.start(App, screens.home); };
    h.querySelector('#h-board').onclick = function () { PIQ.sfx.tap(); PIQ.Board.start(App, screens.home); };
    h.querySelector('#h-rules').onclick = function () { PIQ.sfx.tap(); screens.rules(); };
    if (!state.seen) { state.seen = true; save(); setTimeout(function () { screens.profile(true); }, 400); }
  };

  function unitProgress(u) {
    var n = 0;
    u.lessons.forEach(function (l) { if (state.lessons[l.id]) n++; });
    return n;
  }

  screens.academy = function () {
    App.leave();
    App.setCurrent(ambient());
    App.topbar('Academy', screens.home);
    var html = '<div class="eyebrow">8 units</div><h2>Pick a unit</h2><div class="list">' +
      PIQ.UNITS.map(function (u, i) {
        var n = unitProgress(u);
        return '<button class="item" data-u="' + i + '"><div class="num' + (n === u.lessons.length ? ' done' : '') + '">' + (i + 1) + '</div>' +
          '<div class="txt"><b>' + esc(u.title) + '</b><span>' + esc(u.blurb) + '</span></div><span class="small">' + n + '/' + u.lessons.length + '</span></button>';
      }).join('') + '</div>';
    var s = App.sheet(html, 'tall');
    s.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-u]') : null;
      if (b) { PIQ.sfx.tap(); screens.unit(+b.getAttribute('data-u')); }
    });
  };

  screens.unit = function (ui_) {
    var u = PIQ.UNITS[ui_];
    App.leave();
    App.setCurrent(ambient());
    App.topbar(esc(u.title), screens.academy);
    var html = '<div class="eyebrow">Unit ' + (ui_ + 1) + '</div><h2>' + esc(u.title) + '</h2><p class="small">' + esc(u.blurb) + '</p><div class="list">' +
      u.lessons.map(function (l, i) {
        var st = state.lessons[l.id] || 0;
        return '<button class="item" data-l="' + i + '"><div class="num' + (st ? ' done' : '') + '">' + (i + 1) + '</div>' +
          '<div class="txt"><b>' + esc(l.title) + '</b><span>' + esc(l.sub) + '</span></div>' + App.stars(st) + '</button>';
      }).join('') + '</div>';
    var s = App.sheet(html, 'tall');
    s.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-l]') : null;
      if (b) { PIQ.sfx.tap(); screens.lesson(ui_, +b.getAttribute('data-l')); }
    });
  };

  screens.lesson = function (ui_, li, back) {
    var u = PIQ.UNITS[ui_], l = u.lessons[li];
    back = back || function () { screens.unit(ui_); };
    App.leave();
    var lp = new PIQ.LessonPlayer(stage, l, {});
    App.setCurrent(lp);
    App.topbar(esc(l.title), back);
    App.camDock(l.scene.you || null, '<button data-slow aria-label="Slow motion">' + I.slow + 'SLOW</button>');
    var dock = ui.querySelector('.camdock');
    dock.querySelector('[data-slow]').onclick = function (e) {
      stage.speedScale = stage.speedScale === 0.5 ? 1 : 0.5;
      e.currentTarget.classList.toggle('on', stage.speedScale === 0.5);
      PIQ.sfx.tap();
    };
    var s = App.sheet('<div class="eyebrow" id="ls-eb"></div><div class="caption" id="ls-cap"></div>' +
      '<div class="row between" style="margin-top:12px"><div class="row"><button class="iconbtn" id="ls-prev" aria-label="Previous">' + I.back + '</button>' +
      '<button class="iconbtn" id="ls-replay" aria-label="Replay">' + I.replay + '</button></div>' +
      '<button class="btn" id="ls-next">Next ' + I.next + '</button></div>', 'mini');
    var cap = s.querySelector('#ls-cap'), eb = s.querySelector('#ls-eb'), nextB = s.querySelector('#ls-next');
    function show(i) {
      lp.go(i);
      eb.textContent = 'Step ' + (i + 1) + ' of ' + lp.count();
      cap.innerHTML = PIQ.teamText(l.beats[i].say);
      nextB.innerHTML = i === lp.count() - 1 ? 'Quick check ' + I.next : 'Next ' + I.next;
      s.querySelector('#ls-prev').disabled = i === 0;
      s._fit();
      Array.prototype.forEach.call(dock.querySelectorAll('button[data-cam]'), function (x) { x.classList.remove('on'); });
    }
    s.querySelector('#ls-prev').onclick = function () { PIQ.sfx.tap(); if (lp.i > 0) show(lp.i - 1); };
    s.querySelector('#ls-replay').onclick = function () { PIQ.sfx.tap(); show(lp.i); };
    nextB.onclick = function () {
      PIQ.sfx.tap();
      if (lp.i < lp.count() - 1) show(lp.i + 1);
      else check();
    };
    show(0);

    function check() {
      var qs = PIQ.shuffle(PIQ.quizForLesson(l.id)).slice(0, 2);
      var right = 0, n = 0;
      stage.clearAnnotations(); stage.clearLabels(true);
      if (!qs.length) return finish(3);
      function ask() {
        if (n >= qs.length) return finish(1 + right);
        var q = qs[n];
        s.innerHTML = '<div class="eyebrow">Quick check ' + (n + 1) + ' of ' + qs.length + '</div><div id="qbox"></div><div class="row end" style="margin-top:12px"><button class="btn" id="q-next" hidden>Next ' + I.next + '</button></div>';
        var box = s.querySelector('#qbox');
        box._fit = s._fit;
        if (q.scene) App.sceneFor(q);
        App.question(box, q, function (ok) {
          if (ok) right++;
          n++;
          var nb = s.querySelector('#q-next');
          nb.hidden = false;
          nb.onclick = function () { PIQ.sfx.tap(); ask(); };
          s._fit();
        });
        s._fit();
      }
      ask();
    }
    function finish(stars) {
      stars = Math.min(3, stars);
      var prev = state.lessons[l.id] || 0;
      var first = !prev;
      state.lessons[l.id] = Math.max(prev, stars);
      save();
      PIQ.addXP((first ? 20 : 5) + stars * 5);
      markDay();
      PIQ.award('first');
      ['shape', 'attack', 'defend', 'lead'].forEach(function (id) {
        var unit = PIQ.UNITS.filter(function (x) { return x.id === id; })[0];
        if (unit && unitProgress(unit) === unit.lessons.length) PIQ.award(id);
      });
      var all = PIQ.UNITS.every(function (x) { return unitProgress(x) === x.lessons.length; });
      if (all) PIQ.award('allLessons');
      PIQ.sfx.cheer();
      App.bigmsg(stars === 3 ? 'Brilliant!' : 'Nice work!');
      var nextL = li + 1 < u.lessons.length ? li + 1 : null;
      s.innerHTML = '<div class="eyebrow">Lesson done</div><h2>' + esc(l.title) + '</h2><p>' + App.stars(stars) + '</p>' +
        '<p class="small">' + (stars === 3 ? 'Perfect check. You\'ve got this one!' : 'Watch it again any time to get all 3 stars.') + '</p>' +
        '<div class="row"><button class="btn ghost" id="f-again">' + I.replay + ' Again</button>' +
        (nextL !== null ? '<button class="btn" id="f-next">Next lesson ' + I.next + '</button>' : '<button class="btn" id="f-unit">Back to unit</button>') + '</div>';
      s._fit();
      s.querySelector('#f-again').onclick = function () { PIQ.sfx.tap(); screens.lesson(ui_, li, back); };
      var fn = s.querySelector('#f-next');
      if (fn) fn.onclick = function () { PIQ.sfx.tap(); screens.lesson(ui_, nextL, back); };
      var fu = s.querySelector('#f-unit');
      if (fu) fu.onclick = function () { PIQ.sfx.tap(); back(); };
    }
  };

  // open a lesson by id (used by the rules screen)
  screens.lessonById = function (id, back) {
    for (var i = 0; i < PIQ.UNITS.length; i++) for (var j = 0; j < PIQ.UNITS[i].lessons.length; j++)
      if (PIQ.UNITS[i].lessons[j].id === id) return screens.lesson(i, j, back);
  };

  screens.games = function () {
    App.leave();
    App.setCurrent(ambient());
    App.topbar('Games', screens.home);
    var G = PIQ.GAMES;
    var list = [
      ['spoton', 'Spot On', 'Drag yourself to the right spot on the field.'],
      ['mistake', 'Spot the Mistake', 'One player is in the wrong place. Find her!'],
      ['decide', 'Pass, Dribble or Shoot?', 'You have the ball. Make the smart choice.'],
      ['keeper', 'Keeper Hero', 'Get your angles right and make the save.'],
      ['quizblitz', 'Quiz Blitz', 'Quick-fire questions. Build a streak!']
    ];
    var html = '<div class="eyebrow">Play</div><h2>Games</h2><div class="list">' + list.map(function (g, i) {
      var best = state.games[g[0]];
      return '<button class="item" data-g="' + g[0] + '"><div class="num">' + (i + 1) + '</div><div class="txt"><b>' + g[1] + '</b><span>' + g[2] + '</span></div>' +
        (best != null ? '<span class="small">Best ' + best + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    var s = App.sheet(html, 'tall');
    s.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-g]') : null;
      if (b) { PIQ.sfx.tap(); G[b.getAttribute('data-g')].start(App, screens.games); }
    });
  };

  PIQ.saveBest = function (game, score) {
    if (state.games[game] == null || score > state.games[game]) { state.games[game] = score; save(); return true; }
    return false;
  };
  PIQ.markDay = markDay;

  screens.rules = function () {
    App.leave();
    App.setCurrent(ambient());
    App.topbar('7v7 Rules', screens.home);
    var html = '<div class="eyebrow">Halton &middot; Ontario Soccer U10&ndash;U11</div><h2>The rules</h2>' +
      '<p class="small">Clubs differ a little. Rules marked <span class="flag">Check</span> vary between clubs or need checking against your club\'s current rule sheet.</p>' +
      PIQ.RULES.map(function (r) {
        return '<div class="rule"><h4>' + esc(r.t) + (r.check ? '<span class="flag">Check</span>' : '') + '</h4><p>' + esc(r.d) + '</p>' +
          (r.lesson ? '<button class="btn small ghost" data-lesson="' + r.lesson + '">' + I.play + ' Show me</button>' : '') + '</div>';
      }).join('');
    var s = App.sheet(html, 'tall');
    s.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-lesson]') : null;
      if (b) { PIQ.sfx.tap(); screens.lessonById(b.getAttribute('data-lesson'), screens.rules); }
    });
  };

  screens.profile = function (welcome) {
    App.leave();
    App.setCurrent(ambient());
    App.topbar(welcome ? 'Welcome!' : 'My Player', screens.home);
    var lv = levelOf(state.xp);
    var html = (welcome ? '<h2>Make your player</h2><p class="small">Pick your name, number and team colour. You\'ll see yourself on the field.</p>' : '<div class="eyebrow">' + esc(lv.name) + ' &middot; ' + state.xp + ' XP</div><h2>My player</h2>') +
      '<div class="field"><label for="p-name">Name</label><input id="p-name" maxlength="16" autocomplete="off" value="' + esc(state.name) + '" placeholder="Your name"></div>' +
      '<div class="field"><label for="p-num">Jersey number</label><input id="p-num" type="number" min="1" max="99" inputmode="numeric" value="' + state.number + '"></div>' +
      '<div class="field"><label>Team colour</label><div class="swatches">' + PIQ.JERSEYS.map(function (j) {
        return '<button class="swatch' + (j.id === state.jersey ? ' on' : '') + '" data-j="' + j.id + '" aria-label="' + j.label + '" style="background:' + hexCss(j.shirt) + '"></button>';
      }).join('') + '</div></div>' +
      '<div class="row" style="margin:6px 0 16px"><button class="btn" id="p-save">' + (welcome ? 'Let\'s play!' : 'Save') + '</button></div>' +
      (welcome ? '' :
      '<h3>Badges</h3><div class="badges">' + PIQ.BADGES.map(function (b) {
        return '<div class="badge ' + (state.badges[b.id] ? 'on' : 'off') + '"><b>' + esc(b.name) + '</b>' + esc(b.d) + '</div>';
      }).join('') + '</div>' +
      '<h3 style="margin-top:16px">Settings</h3>' +
      '<div class="row" style="margin-bottom:10px"><span class="grow">Graphics</span><div class="seg" id="p-q"><button data-q="high" class="' + (state.settings.quality !== 'low' ? 'on' : '') + '">Sharp</button><button data-q="low" class="' + (state.settings.quality === 'low' ? 'on' : '') + '">Fast (older devices)</button></div></div>' +
      '<div class="row"><button class="btn small ghost" id="p-reset">Reset progress</button><span class="small" id="p-reset-msg"></span></div>');
    var s = App.sheet(html, 'tall');
    s.addEventListener('click', function (e) {
      var sw = e.target.closest ? e.target.closest('[data-j]') : null;
      if (sw) {
        PIQ.sfx.tap();
        state.jersey = sw.getAttribute('data-j');
        Array.prototype.forEach.call(s.querySelectorAll('.swatch'), function (x) { x.classList.toggle('on', x === sw); });
        applyJersey();
        save();
        if (current && current.destroy) current.destroy();
        App.setCurrent(ambient());
      }
      var qb = e.target.closest ? e.target.closest('[data-q]') : null;
      if (qb) {
        state.settings.quality = qb.getAttribute('data-q'); save();
        stage.setQuality(state.settings.quality);
        Array.prototype.forEach.call(s.querySelectorAll('[data-q]'), function (x) { x.classList.toggle('on', x === qb); });
      }
    });
    s.querySelector('#p-save').onclick = function () {
      var n = s.querySelector('#p-name').value.trim().slice(0, 16);
      var num = parseInt(s.querySelector('#p-num').value, 10);
      state.name = n;
      state.number = isNaN(num) ? state.number : PIQ.clamp(num, 1, 99);
      save();
      PIQ.sfx.good();
      screens.home();
    };
    var rb = s.querySelector('#p-reset');
    if (rb) rb.onclick = function () {
      if (rb.getAttribute('data-armed')) {
        state.xp = 0; state.lessons = {}; state.games = {}; state.badges = {}; state.days = [];
        save();
        s.querySelector('#p-reset-msg').textContent = 'Progress reset.';
        rb.removeAttribute('data-armed'); rb.textContent = 'Reset progress';
      } else {
        rb.setAttribute('data-armed', '1');
        rb.textContent = 'Tap again to reset';
        s.querySelector('#p-reset-msg').textContent = 'This clears XP, stars and badges.';
      }
    };
  };

  PIQ.screens = screens;

  // ---------- boot ----------
  function boot() {
    ui = document.getElementById('ui');
    applyJersey();
    PIQ.sfx.setMuted(!state.settings.sound);
    stage = new PIQ.Stage(document.getElementById('stage'));
    if (!stage.ok) {
      document.getElementById('app').appendChild(el('<div class="nogl"><div><h2 style="font-family:var(--display)">3D isn\'t available</h2><p>This browser couldn\'t start 3D graphics (WebGL). Try Safari or Chrome with hardware acceleration turned on.</p></div></div>'));
      return;
    }
    if (state.settings.quality === 'low') stage.setQuality('low');
    PIQ.stageRef = stage;
    window.addEventListener('resize', function () {
      var s = ui.querySelector('.sheet');
      if (s && s._fit) s._fit();
    });
    var start = (location.hash || '').replace('#', '');
    if (start && screens[start]) screens[start](); else screens.home();
    markDay();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
