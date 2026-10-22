/* Pitch IQ — the 3D stage. One renderer is shared by every screen; screens
   clear it and add their own players, ball, arrows and zones. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var V3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };

  PIQ.COLORS = { run: 0xffe14d, pass: 0xffffff, dribble: 0xff9a3d, good: 0x3ddc84, bad: 0xff5a5f, zone: 0xffe14d, you: 0xffe14d, info: 0x7cc8ff };

  function Stage(container) {
    var self = this;
    this.el = container;
    this.ok = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      this.ok = false;
      return;
    }
    this.quality = 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'stage-canvas';

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    container.appendChild(this.labelLayer);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
    PIQ.buildWorld(this.scene);

    this.dyn = new THREE.Group();   // players + ball
    this.annot = new THREE.Group(); // arrows, zones, links
    this.scene.add(this.dyn);
    this.scene.add(this.annot);

    this.players = {};
    this.list = [];
    this.labels = [];
    this.links = [];
    this.tweens = [];
    this.timers = [];
    this.ball = PIQ.makeBall();
    this.dyn.add(this.ball.obj);
    PIQ.setBallPos(this.ball, 0, 0, 0);
    this.ballTween = null;

    // camera rig (spherical around a target)
    this.rig = { target: V3(0, 0, 0), dist: 52, theta: 0, phi: 0.95 };
    this.goal = { target: V3(0, 0, 0), dist: 52, theta: 0, phi: 0.95 };
    this.pov = null;
    this.autoSpin = 0;
    this.userMoved = false;

    this.handlers = { pick: null, ground: null, dragEnd: null, dragMove: null, groundDrag: null };
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(V3(0, 1, 0), 0);

    this._bindInput();
    this.resize();
    window.addEventListener('resize', function () { self.resize(); });
    this.clock = new THREE.Clock();
    this.running = true;
    var loop = function () {
      if (self.running) self.frame();
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', function () { self.clock.getDelta(); });
  }

  Stage.prototype.setQuality = function (q) {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.resize();
  };

  Stage.prototype.resize = function () {
    if (!this.ok) return;
    var w = this.el.clientWidth || window.innerWidth, h = this.el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    this._applyInset();
    if (this.lastPreset && !this.userMoved) this.setCamera(this.lastPreset, true);
  };

  Stage.prototype.isPortrait = function () { return this.w < this.h; };

  // shift the picture so the action sits in the part of the screen the UI doesn't cover
  Stage.prototype.setInset = function (bottom, right) {
    this.inset = { bottom: bottom || 0, right: right || 0 };
    this._applyInset();
  };
  Stage.prototype._applyInset = function () {
    var i = this.inset || { bottom: 0, right: 0 };
    if (!this.w) return;
    if (i.bottom || i.right) this.camera.setViewOffset(this.w, this.h, i.right * 0.5, i.bottom * 0.5, this.w, this.h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  };

  // ---------- timers (scaled by playback speed) ----------
  Stage.prototype.after = function (sec, fn) {
    this.timers.push({ t: (this.time || 0) + sec, fn: fn });
  };
  // jump every running movement, pass and timer to its end
  Stage.prototype.finishAll = function () {
    var guard = 0;
    while ((this.timers.length || this.ballTween || this.list.some(function (p) { return p.target; })) && guard++ < 20) {
      var ts = this.timers.slice().sort(function (a, b) { return a.t - b.t; });
      this.timers = [];
      ts.forEach(function (x) { x.fn(); });
      this.list.forEach(function (p) {
        if (p.target) { PIQ.setPlayerPos(p, p.target[0], p.target[1]); p.target = null; p.speed = 0; }
      });
      if (this.ballTween) {
        var bt = this.ballTween;
        this.ballTween = null;
        PIQ.setBallPos(this.ball, bt.to[0], bt.to[1], 0);
        if (bt.owner) this.ball.owner = this.players[bt.owner] || null;
        if (bt.onDone) bt.onDone();
      }
    }
    this._carryBall();
  };
  Stage.prototype.snapshot = function () {
    var s = { pos: {}, head: {}, ball: this.ball.pos.slice(), owner: this.ball.owner ? this.ball.owner.id : null, vis: this.ball.obj.visible };
    this.list.forEach(function (p) { s.pos[p.id] = p.pos.slice(); s.head[p.id] = p.heading; });
    return s;
  };
  Stage.prototype.restore = function (s) {
    var self = this;
    this.timers = []; this.ballTween = null;
    this.list.forEach(function (p) {
      if (s.pos[p.id]) { p.target = null; p.speed = 0; PIQ.setPlayerPos(p, s.pos[p.id][0], s.pos[p.id][1]); p.heading = s.head[p.id]; p.obj.rotation.y = p.heading; }
    });
    this.ball.owner = s.owner ? self.players[s.owner] : null;
    this.ball.obj.visible = s.vis;
    PIQ.setBallPos(this.ball, s.ball[0], s.ball[1], 0);
    this._carryBall();
  };

  // ---------- camera ----------
  // presets: 'broadcast' | 'top' | 'behind' | 'coach' | 'wide' | {target:[x,z], dist, theta, phi}
  Stage.prototype.setCamera = function (preset, instant) {
    this.pov = null;
    this.lastPreset = preset;
    this.userMoved = false;
    var F = PIQ.FIELD, portrait = this.isPortrait();
    var tan = Math.tan((this.camera.fov / 2) * Math.PI / 180), asp = this.camera.aspect || 1.5;
    var g = { target: V3(0, 0, 0), dist: 50, theta: 0, phi: 0.95 };
    if (typeof preset === 'object') {
      var t = preset.target || [0, 0];
      g.target = V3(t[0], 0, t[1]);
      g.dist = preset.dist || 40;
      g.theta = preset.theta != null ? preset.theta : 0;
      g.phi = preset.phi != null ? preset.phi : 0.95;
      if (portrait && preset.portraitTheta != null) g.theta = preset.portraitTheta;
      if (portrait && preset.portraitDist) g.dist = preset.portraitDist;
      else if (portrait && preset.theta == null) { g.theta = -Math.PI / 2; g.dist *= 1.25; }
    } else if (preset === 'top') {
      g.phi = 0.3;
      if (portrait) { g.theta = -Math.PI / 2; g.dist = Math.max((F.L / 2 + 1) / tan, (F.W / 2 + 1) / (tan * asp)) * 0.95; }
      else { g.theta = 0; g.dist = Math.max((F.W / 2 + 3) / tan, (F.L / 2 + 1) / (tan * asp)) * 0.95; }
    } else if (preset === 'behind') {
      g.theta = -Math.PI / 2; g.phi = 1.1; g.dist = portrait ? 46 : 36; g.target = V3(4, 0, 0);
    } else if (preset === 'coach') {
      g.theta = 0; g.phi = 1.18; g.dist = portrait ? 44 : 30; g.target = V3(0, 0, 2);
    } else if (preset === 'wide') {
      g.theta = 0.5; g.phi = 1.05; g.dist = portrait ? 90 : 62;
    } else { // broadcast
      if (portrait) { g.theta = -Math.PI / 2; g.phi = 0.6; g.dist = PIQ.clamp((F.W / 2 + 1) / (tan * asp), 50, 95); g.target = V3(0, 0, 0); }
      else { g.theta = 0; g.phi = 0.92; g.dist = PIQ.clamp((F.L / 2 + 2) / (tan * asp), 36, 60); }
    }
    // turn the short way round (the home screen's slow spin can wind theta up)
    var r0 = this.rig.theta;
    while (g.theta - r0 > Math.PI) g.theta -= Math.PI * 2;
    while (g.theta - r0 < -Math.PI) g.theta += Math.PI * 2;
    this.goal = g;
    if (instant) {
      this.rig.target.copy(g.target); this.rig.dist = g.dist; this.rig.theta = g.theta; this.rig.phi = g.phi;
    }
  };

  // first-person view from a player's eyes, looking at `look` ([x,z]) or along her heading
  Stage.prototype.setPOV = function (id, look) {
    var p = this.players[id];
    if (!p) return;
    this.pov = { p: p, look: look || null, yaw: 0, pitch: -0.08 };
  };

  Stage.prototype._applyCamera = function (dt) {
    var cam = this.camera;
    if (this.pov) {
      var p = this.pov.p;
      var look = this.pov.look || this.ball.pos;
      var base = Math.atan2(look[0] - p.pos[0], look[1] - p.pos[1]) + this.pov.yaw;
      var eyeY = 1.5 * PIQ.FIG_SCALE;
      var eye = V3(p.pos[0] - Math.sin(base) * 0.25, eyeY, p.pos[1] - Math.cos(base) * 0.25);
      cam.position.lerp(eye, Math.min(1, dt * 6));
      var tgt = V3(eye.x + Math.sin(base) * 10, eyeY + Math.tan(this.pov.pitch) * 10, eye.z + Math.cos(base) * 10);
      cam.lookAt(tgt);
      p.obj.visible = false;
      this._povHidden = p;
      return;
    }
    if (this._povHidden) { this._povHidden.obj.visible = true; this._povHidden = null; }
    var r = this.rig, g = this.goal, k = Math.min(1, dt * 3.2);
    if (!this.dragging && this.autoSpin) g.theta += this.autoSpin * dt;
    r.target.lerp(g.target, k);
    r.dist += (g.dist - r.dist) * k;
    var dth = g.theta - r.theta;
    r.theta += dth * k;
    r.phi += (g.phi - r.phi) * k;
    var sp = Math.sin(r.phi);
    cam.position.set(r.target.x + r.dist * sp * Math.sin(r.theta), r.target.y + r.dist * Math.cos(r.phi), r.target.z + r.dist * sp * Math.cos(r.theta));
    // keep "up" stable when looking straight down
    if (r.phi < 0.02) cam.up.set(-Math.sin(r.theta), 0, -Math.cos(r.theta));
    else cam.up.set(0, 1, 0);
    cam.lookAt(r.target);
  };

  // ---------- content ----------
  Stage.prototype.clear = function () {
    var self = this;
    this.list.forEach(function (p) { self.dyn.remove(p.obj); });
    this.players = {}; this.list = [];
    this.clearAnnotations();
    this.labels.forEach(function (l) { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); });
    this.labels = [];
    this.tweens = [];
    this.timers = [];
    this.ballTween = null;
    this.ball.owner = null;
    this.ball.draggable = false;
    this.ball.obj.visible = true;
    PIQ.setBallPos(this.ball, 0, 0, 0);
    this.handlers = { pick: null, ground: null, dragEnd: null, dragMove: null, groundDrag: null };
    this.pov = null;
    this.autoSpin = 0;
  };

  Stage.prototype.clearAnnotations = function () {
    var a = this.annot;
    while (a.children.length) {
      var c = a.children[0];
      a.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    this.links = [];
  };

  // spec: {id, team, num, role, at:[x,z], you:bool, label}
  Stage.prototype.addPlayer = function (spec) {
    var p = PIQ.makePlayer(spec);
    PIQ.setPlayerPos(p, spec.at[0], spec.at[1]);
    if (spec.heading != null) { p.heading = spec.heading; p.obj.rotation.y = spec.heading; }
    this.dyn.add(p.obj);
    this.players[spec.id] = p;
    this.list.push(p);
    if (spec.you) {
      PIQ.setRing(p, PIQ.COLORS.you, true);
      this.label(spec.id, spec.youLabel || 'YOU', 'you');
    }
    return p;
  };

  Stage.prototype.setBall = function (at, ownerId) {
    this.ballTween = null;
    this.ball.owner = ownerId ? this.players[ownerId] : null;
    PIQ.setBallPos(this.ball, at[0], at[1], 0);
  };

  // move a player to [x,z] over dur seconds (dur defaults to a jog speed)
  Stage.prototype.moveTo = function (id, to, dur) {
    var p = this.players[id];
    if (!p) return;
    var d = PIQ.dist(p.pos, to);
    if (d < 0.01) return;
    p.from = p.pos.slice();
    p.target = to.slice();
    p.dur = dur || Math.max(0.4, d / 5.5);
    p.t0 = this.time || 0;
    p.heading = Math.atan2(to[0] - p.pos[0], to[1] - p.pos[1]);
  };

  Stage.prototype.placeAll = function (map) {
    for (var id in map) if (this.players[id]) { var p = this.players[id]; p.target = null; PIQ.setPlayerPos(p, map[id][0], map[id][1]); }
  };

  // ball travels to [x,z]; opts {dur, height, owner(id at end), onDone}
  Stage.prototype.kickBall = function (to, opts) {
    opts = opts || {};
    var from = this.ball.pos.slice();
    var d = PIQ.dist(from, to);
    this.ball.owner = null;
    this.ballTween = {
      from: from, to: to.slice(), t0: this.time || 0,
      dur: opts.dur || Math.max(0.35, d / 16),
      height: opts.height || 0,
      owner: opts.owner || null,
      onDone: opts.onDone || null
    };
    if (!opts.silent) PIQ.sfx.kick();
  };

  Stage.prototype.giveBall = function (id) {
    this.ballTween = null;
    this.ball.owner = this.players[id] || null;
  };

  // ---------- annotations ----------
  function ribbon(points, width, y) {
    // flat strip on the ground following points [[x,z],...]
    var pos = [], idx = [];
    for (var i = 0; i < points.length; i++) {
      var a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var l = Math.sqrt(dx * dx + dz * dz) || 1;
      var nx = -dz / l * width / 2, nz = dx / l * width / 2;
      pos.push(points[i][0] + nx, y, points[i][1] + nz, points[i][0] - nx, y, points[i][1] - nz);
      if (i < points.length - 1) {
        var k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  function curvePoints(a, b, bend, n) {
    var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dz = b[1] - a[1];
    var cx = mx - dz * (bend || 0), cz = mz + dx * (bend || 0);
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cz + t * t * b[1]]);
    }
    return pts;
  }

  function trimPath(pts, startCut, endCut) {
    // remove length from the ends so arrows don't overlap the players
    function cut(list, amount) {
      var out = list.slice();
      while (out.length > 2 && amount > 0) {
        var d = PIQ.dist(out[0], out[1]);
        if (d > amount) {
          var t = amount / d;
          out[0] = [PIQ.lerp(out[0][0], out[1][0], t), PIQ.lerp(out[0][1], out[1][1], t)];
          break;
        }
        amount -= d; out.shift();
      }
      return out;
    }
    var p = cut(pts, startCut);
    p.reverse();
    p = cut(p, endCut);
    p.reverse();
    return p;
  }

  // kind: 'run' | 'pass' | 'dribble'; opts {color, bend, width, startCut, endCut, y}
  Stage.prototype.arrow = function (from, to, kind, opts) {
    opts = opts || {};
    kind = kind || 'run';
    var color = opts.color != null ? opts.color : PIQ.COLORS[kind] || PIQ.COLORS.run;
    var width = opts.width || (kind === 'pass' ? 0.28 : 0.36);
    var y = opts.y || 0.03 + this.annot.children.length * 0.0005;
    var pts = curvePoints(from, to, opts.bend || 0, 28);
    if (kind === 'dribble') {
      pts = pts.map(function (p, i) {
        if (i === 0 || i === pts.length - 1) return p;
        var a = pts[i - 1], b = pts[i + 1];
        var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.sqrt(dx * dx + dz * dz) || 1;
        var w = Math.sin(i * 1.3) * 0.35;
        return [p[0] - dz / l * w, p[1] + dx / l * w];
      });
    }
    pts = trimPath(pts, opts.startCut != null ? opts.startCut : 0.7, opts.endCut != null ? opts.endCut : 0.5);
    var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
    var grp = new THREE.Group();
    var head = 1.1;
    var body = trimPath(pts, 0, head * 0.8);
    if (kind === 'pass') {
      // dashes
      var acc = [], dashOn = true, run = 0;
      for (var i = 1; i < body.length; i++) {
        var seg = PIQ.dist(body[i - 1], body[i]);
        if (dashOn) acc.push(body[i - 1]);
        run += seg;
        if (run > 0.9) {
          if (dashOn) { acc.push(body[i]); if (acc.length > 1) grp.add(new THREE.Mesh(ribbon(acc, width, y), mat)); acc = []; }
          dashOn = !dashOn; run = 0;
        }
      }
      if (acc.length > 1) grp.add(new THREE.Mesh(ribbon(acc, width, y), mat));
    } else if (body.length > 1) {
      grp.add(new THREE.Mesh(ribbon(body, width, y), mat));
    }
    // head
    var e = pts[pts.length - 1], s = pts[Math.max(0, pts.length - 4)];
    var ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
    var shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(-head, head * 0.55); shape.lineTo(-head, -head * 0.55); shape.lineTo(0, 0);
    var hm = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    // ShapeGeometry lies in XY; after the -90deg X rotation shape Y maps to -Z, so the angle flips
    hm.position.set(e[0], y + 0.001, e[1]);
    hm.rotation.set(-Math.PI / 2, 0, -ang);
    grp.add(hm);
    this.annot.add(grp);
    return grp;
  };

  // circle zone: zone([x,z], r, opts) ; rect zone: zone([x1,z1,x2,z2], null, opts)
  Stage.prototype.zone = function (at, r, opts) {
    opts = opts || {};
    var color = opts.color != null ? opts.color : PIQ.COLORS.zone;
    var grp = new THREE.Group();
    var fill = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opts.opacity || 0.22, depthWrite: false });
    var edge = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, depthWrite: false });
    var y = 0.02 + this.annot.children.length * 0.0007;
    if (r) {
      grp.position.set(at[0], 0, at[1]);
      var f = new THREE.Mesh(new THREE.CircleGeometry(r, 40), fill);
      f.rotation.x = -Math.PI / 2; f.position.set(0, y, 0); grp.add(f);
      var e = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 48), edge);
      e.rotation.x = -Math.PI / 2; e.position.set(0, y + 0.001, 0); grp.add(e);
    } else {
      var x1 = Math.min(at[0], at[2]), x2 = Math.max(at[0], at[2]), z1 = Math.min(at[1], at[3]), z2 = Math.max(at[1], at[3]);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), fill);
      m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); grp.add(m);
      var w = 0.12;
      [[x1, z1, x2, z1], [x1, z2, x2, z2], [x1, z1, x1, z2], [x2, z1, x2, z2]].forEach(function (s) {
        var len = Math.max(Math.abs(s[2] - s[0]), Math.abs(s[3] - s[1]));
        var horiz = s[1] === s[3];
        var b = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? len : w, horiz ? w : len), edge);
        b.rotation.x = -Math.PI / 2; b.position.set((s[0] + s[2]) / 2, y + 0.001, (s[1] + s[3]) / 2);
        grp.add(b);
      });
    }
    if (opts.pulse) grp.userData.pulse = true;
    this.annot.add(grp);
    return grp;
  };

  // a line drawn between two players that follows them (triangles, shape)
  Stage.prototype.link = function (idA, idB, color) {
    var mat = new THREE.MeshBasicMaterial({ color: color != null ? color : PIQ.COLORS.info, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.annot.add(mesh);
    this.links.push({ a: idA, b: idB, mesh: mesh });
  };

  Stage.prototype._updateLinks = function () {
    var self = this;
    this.links.forEach(function (l) {
      var a = l.a === 'ball' ? self.ball : self.players[l.a];
      var b = l.b === 'ball' ? self.ball : self.players[l.b];
      if (!a || !b) return;
      var g = ribbon([a.pos, b.pos], 0.16, 0.035);
      l.mesh.geometry.dispose();
      l.mesh.geometry = g;
    });
  };

  // ---------- floating HTML labels ----------
  // target: player id, 'ball', or [x,z]; cls: 'you' | 'think' | 'tag' | 'call' | 'good' | 'bad'
  Stage.prototype.label = function (target, html, cls, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'flabel ' + (cls || 'tag');
    el.innerHTML = html;
    this.labelLayer.appendChild(el);
    var l = { el: el, target: target, y: opts.y != null ? opts.y : (cls === 'you' ? 2.05 : 2.3), ttl: opts.ttl || 0, born: this.time || 0 };
    this.labels.push(l);
    return l;
  };
  Stage.prototype.removeLabel = function (l) {
    if (!l) return;
    if (l.el.parentNode) l.el.parentNode.removeChild(l.el);
    this.labels = this.labels.filter(function (x) { return x !== l; });
  };
  Stage.prototype.clearLabels = function (keepYou) {
    var keep = [];
    this.labels.forEach(function (l) {
      if (keepYou && /\byou\b/.test(l.el.className)) keep.push(l);
      else if (l.el.parentNode) l.el.parentNode.removeChild(l.el);
    });
    this.labels = keep;
  };

  Stage.prototype._updateLabels = function () {
    var cam = this.camera, w = this.w, h = this.h, self = this, v = new THREE.Vector3();
    var dead = [];
    this.labels.forEach(function (l) {
      var pos;
      if (l.target === 'ball') pos = [self.ball.pos[0], self.ball.pos[1]];
      else if (typeof l.target === 'string') {
        var p = self.players[l.target];
        if (!p || !p.obj.visible) { l.el.style.display = 'none'; return; }
        pos = p.pos;
      } else pos = l.target;
      v.set(pos[0], l.y, pos[1]).project(cam);
      if (v.z > 1 || v.z < -1) { l.el.style.display = 'none'; return; }
      l.el.style.display = '';
      var x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-100%)';
      if (l.ttl && self.time - l.born > l.ttl) dead.push(l);
    });
    dead.forEach(function (l) { self.removeLabel(l); });
  };

  // project a world point to screen pixels (for placing UI)
  Stage.prototype.toScreen = function (x, z, y) {
    var v = new THREE.Vector3(x, y || 0, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h];
  };

  // ---------- input ----------
  Stage.prototype.on = function (name, fn) { this.handlers[name] = fn; };
  Stage.prototype.setDraggable = function (ids, on) {
    var self = this;
    ids.forEach(function (id) {
      if (id === 'ball') self.ball.draggable = on !== false;
      else if (self.players[id]) self.players[id].draggable = on !== false;
    });
  };

  Stage.prototype._ray = function (cx, cy) {
    var r = this.canvas.getBoundingClientRect();
    var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster;
  };
  Stage.prototype._groundAt = function (cx, cy) {
    var ray = this._ray(cx, cy).ray, out = new THREE.Vector3();
    if (!ray.intersectPlane(this.groundPlane, out)) return null;
    return [out.x, out.z];
  };
  Stage.prototype._hitPlayer = function (cx, cy, onlyDraggable) {
    var hits = [];
    this.list.forEach(function (p) { if (p.obj.visible && (!onlyDraggable || p.draggable)) hits.push(p.hit); });
    if (!onlyDraggable || this.ball.draggable) hits.push(this.ball.hit);
    var res = this._ray(cx, cy).intersectObjects(hits, false);
    if (!res.length) return null;
    return res[0].object.userData.player || res[0].object.userData.ball;
  };

  Stage.prototype._bindInput = function () {
    var self = this, c = this.canvas;
    var st = null; // {x,y,sx,sy,mode,obj,moved,touches}
    var F = PIQ.FIELD;

    function start(x, y) {
      PIQ.sfx.unlock();
      var drag = self._hitPlayer(x, y, true);
      var gd = !drag && self.handlers.groundDrag;
      st = { x: x, y: y, sx: x, sy: y, moved: false, mode: drag ? 'drag' : gd ? 'gdrag' : 'orbit', obj: drag };
      if (drag) { self.dragging = true; c.style.cursor = 'grabbing'; }
      if (gd) { var g0 = self._groundAt(x, y); if (g0) self.handlers.groundDrag(g0, 'start'); }
    }
    function move(x, y) {
      if (!st) {
        var hov = self._hitPlayer(x, y, true);
        c.style.cursor = hov ? 'grab' : 'default';
        return;
      }
      var dx = x - st.x, dy = y - st.y;
      if (Math.abs(x - st.sx) + Math.abs(y - st.sy) > 6) st.moved = true;
      st.x = x; st.y = y;
      if (st.mode === 'drag' && st.obj) {
        var g = self._groundAt(x, y);
        if (!g) return;
        g[0] = PIQ.clamp(g[0], -F.L / 2 - 1, F.L / 2 + 1);
        g[1] = PIQ.clamp(g[1], -F.W / 2 - 1, F.W / 2 + 1);
        if (st.obj.isBall) PIQ.setBallPos(st.obj, g[0], g[1], 0);
        else {
          var p = st.obj;
          var ddx = g[0] - p.pos[0], ddz = g[1] - p.pos[1];
          if (ddx * ddx + ddz * ddz > 0.0004) p.heading = Math.atan2(ddx, ddz);
          p.target = null;
          p.speed = Math.min(6, Math.sqrt(ddx * ddx + ddz * ddz) * 30);
          PIQ.setPlayerPos(p, g[0], g[1]);
          p._dragSpeedT = 0.15;
        }
        if (self.handlers.dragMove) self.handlers.dragMove(st.obj);
      } else if (st.mode === 'gdrag') {
        var gm = self._groundAt(x, y);
        if (gm && self.handlers.groundDrag) self.handlers.groundDrag(gm, 'move');
      } else if (st.mode === 'orbit') {
        if (self.pov) {
          self.pov.yaw -= dx * 0.006;
          self.pov.pitch = PIQ.clamp(self.pov.pitch - dy * 0.004, -0.6, 0.4);
        } else {
          self.userMoved = true;
          self.goal.theta -= dx * 0.006;
          self.goal.phi = PIQ.clamp(self.goal.phi - dy * 0.005, 0.001, 1.42);
          self.rig.theta = self.goal.theta; self.rig.phi = self.goal.phi;
        }
      }
    }
    function end() {
      if (!st) return;
      if (st.mode === 'drag' && st.obj && self.handlers.dragEnd) self.handlers.dragEnd(st.obj);
      if (st.mode === 'gdrag' && self.handlers.groundDrag) {
        var ge = self._groundAt(st.x, st.y);
        self.handlers.groundDrag(ge, 'end', st.moved);
        if (st.moved) { st = null; self.dragging = false; return; }
      }
      if (!st.moved) {
        var hit = self._hitPlayer(st.sx, st.sy, false);
        if (hit && self.handlers.pick) self.handlers.pick(hit);
        else if (self.handlers.ground) {
          var g = self._groundAt(st.sx, st.sy);
          if (g) self.handlers.ground(g);
        }
      }
      self.dragging = false;
      c.style.cursor = 'default';
      st = null;
    }
    function zoom(f) {
      if (self.pov) return;
      self.userMoved = true;
      self.goal.dist = PIQ.clamp(self.goal.dist * f, 8, 140);
    }
    function pan(dx, dy) {
      if (self.pov) return;
      self.userMoved = true;
      var s = self.rig.dist * 0.0016;
      var th = self.rig.theta;
      // screen right = (cos th, 0, -sin th); screen up (on ground) = (-sin th, 0, -cos th)
      var t = self.goal.target;
      t.x += (-dx * Math.cos(th) + dy * -Math.sin(th)) * s;
      t.z += (dx * Math.sin(th) + dy * -Math.cos(th)) * s;
      t.x = PIQ.clamp(t.x, -F.L / 2 - 10, F.L / 2 + 10);
      t.z = PIQ.clamp(t.z, -F.W / 2 - 10, F.W / 2 + 10);
    }

    c.addEventListener('mousedown', function (e) { if (e.button === 2 || e.shiftKey) { st = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, mode: 'pan', moved: true }; return; } start(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) {
      if (st && st.mode === 'pan') { pan(e.clientX - st.x, e.clientY - st.y); st.x = e.clientX; st.y = e.clientY; return; }
      if (e.target === c || st) move(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function () { if (st && st.mode === 'pan') { st = null; return; } end(); });
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    c.addEventListener('wheel', function (e) { e.preventDefault(); zoom(e.deltaY > 0 ? 1.08 : 0.926); }, { passive: false });

    var pinch = null;
    c.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (e.touches.length === 1) { pinch = null; start(e.touches[0].clientX, e.touches[0].clientY); }
      else if (e.touches.length === 2) {
        if (st && st.mode === 'drag' && st.obj && self.handlers.dragEnd) self.handlers.dragEnd(st.obj);
        st = null; self.dragging = false;
        var a = e.touches[0], b = e.touches[1];
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
      }
    }, { passive: false });
    c.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (pinch && e.touches.length === 2) {
        var a = e.touches[0], b = e.touches[1];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        var mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
        if (d > 10) zoom(pinch.d / d);
        pan(mx - pinch.mx, my - pinch.my);
        pinch = { d: d, mx: mx, my: my };
      } else if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    c.addEventListener('touchend', function (e) {
      e.preventDefault();
      if (e.touches.length === 0) { if (!pinch) end(); pinch = null; st = null; self.dragging = false; }
    }, { passive: false });
  };

  Stage.prototype._carryBall = function () {
    var b = this.ball, o = b.owner;
    if (!o || this.ballTween) return;
    var hd = o.obj.rotation.y;
    var bob = o.speed > 0.4 ? Math.sin(o.phase) * 0.12 : 0;
    PIQ.setBallPos(b, o.pos[0] + Math.sin(hd) * (0.62 + bob), o.pos[1] + Math.cos(hd) * (0.62 + bob), 0);
  };

  // ---------- frame ----------
  Stage.prototype.frame = function () {
    var dt = Math.min(this.clock.getDelta(), 0.1) * (this.speedScale || 1);
    this.time = (this.time || 0) + dt;
    var t = this.time, self = this;
    if (this.timers.length) {
      var due = this.timers.filter(function (x) { return x.t <= t; });
      if (due.length) {
        this.timers = this.timers.filter(function (x) { return x.t > t; });
        due.forEach(function (x) { x.fn(); });
      }
    }

    // player tweens
    this.list.forEach(function (p) {
      if (p.target) {
        var k = PIQ.clamp((t - p.t0) / p.dur, 0, 1);
        var e = PIQ.ease(k);
        var nx = PIQ.lerp(p.from[0], p.target[0], e), nz = PIQ.lerp(p.from[1], p.target[1], e);
        var vx = nx - p.pos[0], vz = nz - p.pos[1];
        p.speed = Math.sqrt(vx * vx + vz * vz) / Math.max(dt, 0.001);
        PIQ.setPlayerPos(p, nx, nz);
        if (k >= 1) { p.target = null; p.speed = 0; }
      } else if (p._dragSpeedT > 0) {
        p._dragSpeedT -= dt;
        if (p._dragSpeedT <= 0) p.speed = 0;
      } else p.speed = 0;
      PIQ.animatePlayer(p, dt, self.ball.pos);
    });

    // ball
    var b = this.ball;
    if (this.ballTween) {
      var bt = this.ballTween;
      var k2 = PIQ.clamp((t - bt.t0) / bt.dur, 0, 1);
      var e2 = bt.height ? k2 : 1 - Math.pow(1 - k2, 1.6);
      var h = bt.height ? 4 * bt.height * k2 * (1 - k2) : 0;
      PIQ.setBallPos(b, PIQ.lerp(bt.from[0], bt.to[0], e2), PIQ.lerp(bt.from[1], bt.to[1], e2), h);
      if (k2 >= 1) {
        this.ballTween = null;
        if (bt.owner) b.owner = this.players[bt.owner] || null;
        if (bt.onDone) bt.onDone();
      }
    } else this._carryBall();

    // pulse zones
    var pulse = 0.85 + Math.sin(t * 4) * 0.15;
    this.annot.children.forEach(function (g) { if (g.userData.pulse) g.scale.set(pulse, 1, pulse); });

    this._updateLinks();
    this._applyCamera(dt);
    this._updateLabels();
    this.renderer.render(this.scene, this.camera);
  };

  PIQ.Stage = Stage;
})();
