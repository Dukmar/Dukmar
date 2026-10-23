/* Pitch IQ — fans on the sidelines, team-coloured goal ends, and team colours
   on the nets so it's always clear which end belongs to which team.
   Fans are instanced meshes (a handful of draw calls for ~60 people), which keeps
   older Macs happy. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  var SKIN = [0xf1c7a5, 0xe0ac86, 0xc68a5e, 0x9a6440, 0x6e4529, 0xf6d6bd];
  var HAIR = [0x2b1c12, 0x4a2f1b, 0x7a4a24, 0xd8a94e, 0x9a9a9a, 0x141414, 0xa8471f];
  var OTHER = [0x3a7bd5, 0x7f8c8d, 0x2c3e50, 0xf39c12, 0x16a085, 0xecf0f1, 0x8e5a2b];

  function Crowd(scene) {
    var F = PIQ.FIELD;
    this.fans = [];
    var self = this;
    function add(x, z) {
      var r = Math.random();
      self.fans.push({
        x: x + (Math.random() - 0.5) * 0.5, z: z + (Math.random() - 0.5) * 0.5,
        h: Math.atan2(-x * 0.3, -z), s: 1.15 + Math.random() * 0.5,
        team: r < 0.55 ? 'home' : r < 0.78 ? 'away' : 'other',
        other: PIQ.pick(OTHER), skin: PIQ.pick(SKIN), hair: PIQ.pick(HAIR),
        ph: Math.random() * 6.28, jump: 0.7 + Math.random() * 0.6
      });
    }
    var hz = F.W / 2, hx = F.L / 2;
    // two rows along the far touchline, behind the boards (gaps behind the benches)
    [hz + 6.3, hz + 7.7].forEach(function (d, row) {
      for (var x = -hx + 0.5 + row * 0.8; x < hx; x += 1.7) {
        if (Math.abs(Math.abs(x) - 8) < 3.2 && row === 0) continue;
        add(x, -d);
      }
    });
    // a row behind each goal
    [-1, 1].forEach(function (s) {
      for (var z = -11; z <= 11; z += 1.9) {
        var f = { x: s * (hx + 6.6), z: z };
        add(f.x, f.z);
        self.fans[self.fans.length - 1].h = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    });
    var n = this.fans.length;
    function inst(geo, color) {
      var m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    }
    this.legs = inst(new THREE.CylinderGeometry(0.11, 0.1, 0.8, 8));
    this.body = inst(new THREE.CylinderGeometry(0.21, 0.24, 0.62, 10));
    this.head = inst(new THREE.SphereGeometry(0.15, 12, 10));
    this.hairM = inst(new THREE.SphereGeometry(0.165, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6));
    this.armL = inst(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6));
    this.armR = inst(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6));
    var c = new THREE.Color();
    for (var i = 0; i < n; i++) {
      var f = this.fans[i];
      this.legs.setColorAt(i, c.setHex(0x2a2f3a));
      this.head.setColorAt(i, c.setHex(f.skin));
      this.hairM.setColorAt(i, c.setHex(f.hair));
    }
    this.cheerT = 0;
    this.t = 0;
    this.recolor();
    this._m = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._l = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this.update(0);
  }

  Crowd.prototype.recolor = function () {
    var c = new THREE.Color();
    for (var i = 0; i < this.fans.length; i++) {
      var f = this.fans[i];
      var col = f.team === 'home' ? PIQ.TEAMS.home.shirt : f.team === 'away' ? PIQ.TEAMS.away.shirt : f.other;
      this.body.setColorAt(i, c.setHex(col));
      this.armL.setColorAt(i, c.setHex(col));
      this.armR.setColorAt(i, c.setHex(col));
    }
    [this.body, this.armL, this.armR, this.legs, this.head, this.hairM].forEach(function (m) { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  };

  Crowd.prototype.cheer = function (secs) { this.cheerT = Math.max(this.cheerT, secs || 2.5); };

  // a home fan's position, for shouting
  Crowd.prototype.someFan = function () {
    var home = this.fans.filter(function (f) { return f.team === 'home'; });
    var f = PIQ.pick(home.length ? home : this.fans);
    return [f.x, f.z, f.s];
  };

  Crowd.prototype.update = function (dt) {
    this.t += dt;
    var cheering = this.cheerT > 0;
    if (cheering) this.cheerT -= dt;
    // idle crowds barely move: only redraw every few frames to save older machines
    this._skip = (this._skip || 0) + 1;
    if (!cheering && !this._wasCheering && this._skip % 4 !== 0 && dt > 0) return;
    this._wasCheering = cheering;
    var t = this.t, M = this._m, B = this._b, L = this._l, q = this._q, v = this._v, sc = this._s, e = this._e;
    var amt = cheering ? Math.min(1, this.cheerT) : 0;
    var i;
    function put(mesh, x, y, z, rx, rz) {
      q.setFromEuler(e.set(rx || 0, 0, rz || 0));
      L.compose(v.set(x, y, z), q, sc.set(1, 1, 1));
      M.multiplyMatrices(B, L);
      mesh.setMatrixAt(i, M);
    }
    for (i = 0; i < this.fans.length; i++) {
      var f = this.fans[i];
      var hop = amt * Math.abs(Math.sin(t * 7 * f.jump + f.ph)) * 0.35;
      var sway = Math.sin(t * 1.3 + f.ph) * 0.04;
      q.setFromEuler(e.set(0, f.h + sway, 0));
      B.compose(v.set(f.x, hop, f.z), q, sc.set(f.s, f.s, f.s));
      put(this.legs, 0, 0.4, 0);
      put(this.body, 0, 1.1, 0);
      put(this.head, 0, 1.58, 0);
      put(this.hairM, 0, 1.6, -0.015, -0.4);
      var up = amt > 0 ? Math.PI * 0.85 + Math.sin(t * 9 + f.ph) * 0.25 * amt : 0.12;
      // arm cylinders pivot at the shoulder: offset half a length along the rotated arm
      for (var k = -1; k <= 1; k += 2) {
        var ang = k * up;
        put(k < 0 ? this.armL : this.armR, k * 0.25 + Math.sin(ang) * 0.27, 1.35 - Math.cos(ang) * 0.27, 0, 0, ang);
      }
    }
    [this.legs, this.body, this.head, this.hairM, this.armL, this.armR].forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
  };

  PIQ.Crowd = Crowd;

  // ---------- team ends: banners behind each goal, nets in team colours ----------
  function bannerTex(text, color) {
    return PIQ.canvasTex(1024, 96, function (g, w, h) {
      g.fillStyle = '#' + ('000000' + color.toString(16)).slice(-6);
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (var x = 0; x < w; x += 64) g.fillRect(x, 0, 32, 8);
      g.fillStyle = '#ffffff';
      g.font = 'bold 60px Arial, Helvetica, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text + '   •   ' + text + '   •   ' + text, w / 2, h / 2 + 4);
    });
  }

  PIQ.TeamEnds = function (scene, goals) {
    var F = PIQ.FIELD;
    this.goals = goals;
    this.banners = [];
    var self = this;
    [-1, 1].forEach(function (s) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.position.set(s * (F.L / 2 + 4.8), 0.95, 0);
      m.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(m);
      self.banners.push(m);
    });
    this.recolor();
  };
  PIQ.TeamEnds.prototype.recolor = function () {
    var home = PIQ.TEAMS.home.shirt, away = PIQ.TEAMS.away.shirt;
    var word = (PIQ.teamWord || 'our').toUpperCase();
    var specs = [['OUR GOAL', home], ['THEIR GOAL', away]];
    this.banners.forEach(function (m, i) {
      if (m.material.map) m.material.map.dispose();
      m.material.map = bannerTex(specs[i][0], specs[i][1]);
      m.material.needsUpdate = true;
    });
    // nets: ours in our colour, theirs in theirs
    this.goals.forEach(function (g, i) {
      var net = g.userData.net;
      if (net) net.material.color.setHex(i === 0 ? home : away).lerp(new THREE.Color(0xffffff), 0.35);
      if (net) net.material.opacity = 0.7;
    });
    return word;
  };
})();
