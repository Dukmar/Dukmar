/* Pitch IQ — the 3D world: a 7v7 pitch, goals, sky and park surroundings.
   Units are metres. The pitch runs along X (our team attacks +X, to the right
   in the TV view) and across Z (+Z is the near touchline, closest to the camera). */
(function () {
  'use strict';
  var PIQ = window.PIQ;

  // Field dimensions: mid-range values from the Peel Halton 2026 7v7 spec
  // (30–36 m × 40–55 m, 16 × 6 ft goals) and Ontario's adapted laws (see RESEARCH.md).
  PIQ.FIELD = {
    L: 50,            // touchline length (goal line to goal line)
    W: 34,            // goal line width (touchline to touchline)
    goalW: 4.88,      // 16 ft
    goalH: 1.83,      // 6 ft
    boxD: 11,         // penalty area depth (Ontario: 10–12 m)
    boxW: 22,         // penalty area width (Ontario: 20–24 m)
    penSpot: 8,       // penalty mark, 8 m out
    circleR: 5,       // centre circle radius
    retreat: 50 / 3   // U10–U11 retreat line: the one-third line at each end
  };

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  PIQ.canvasTex = canvasTex;

  function grassTexture(L, W) {
    return canvasTex(1024, 512, function (g, w, h) {
      var stripes = Math.round(L / 5);
      for (var i = 0; i < stripes; i++) {
        g.fillStyle = i % 2 ? '#3f9a45' : '#47a84c';
        g.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
      }
      // speckle so it doesn't look like plastic
      for (var k = 0; k < 9000; k++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(20,70,20,0.10)' : 'rgba(200,240,160,0.07)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
  }

  function lineMat() {
    return new THREE.MeshBasicMaterial({ color: 0xf7f7f2 });
  }

  function addStrip(group, x1, z1, x2, z2, width, mat, y) {
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dz * dz);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(dz, dx);
    m.position.set((x1 + x2) / 2, y || 0.012, (z1 + z2) / 2);
    group.add(m);
    return m;
  }

  function addArc(group, cx, cz, r, start, length, width, mat) {
    var g = new THREE.RingGeometry(r - width / 2, r + width / 2, 64, 1, start, length);
    var m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.012, cz);
    group.add(m);
    return m;
  }

  function addDisc(group, cx, cz, r, mat) {
    var m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.013, cz);
    group.add(m);
  }

  function buildLines(F) {
    var g = new THREE.Group();
    var mat = lineMat();
    var lw = 0.12, hx = F.L / 2, hz = F.W / 2;
    // boundary
    addStrip(g, -hx, -hz, hx, -hz, lw, mat);
    addStrip(g, -hx, hz, hx, hz, lw, mat);
    addStrip(g, -hx, -hz, -hx, hz, lw, mat);
    addStrip(g, hx, -hz, hx, hz, lw, mat);
    // halfway + circle + spot
    addStrip(g, 0, -hz, 0, hz, lw, mat);
    addArc(g, 0, 0, F.circleR, 0, Math.PI * 2, lw, mat);
    addDisc(g, 0, 0, 0.18, mat);
    [-1, 1].forEach(function (s) {
      var gx = s * hx;
      // penalty area
      var bx = gx - s * F.boxD;
      addStrip(g, gx, -F.boxW / 2, bx, -F.boxW / 2, lw, mat);
      addStrip(g, gx, F.boxW / 2, bx, F.boxW / 2, lw, mat);
      addStrip(g, bx, -F.boxW / 2, bx, F.boxW / 2, lw, mat);
      // penalty mark
      addDisc(g, gx - s * F.penSpot, 0, 0.14, mat);
      // corner arcs
      [-1, 1].forEach(function (t) {
        // ring angle a points along world (cos a, 0, -sin a) after the -90deg X rotation
        var start = s > 0 ? (t > 0 ? Math.PI / 2 : Math.PI) : (t > 0 ? 0 : Math.PI * 1.5);
        addArc(g, gx, t * hz, 1, start, Math.PI / 2, lw, mat);
      });
      // retreat line: dashed, pale blue so it reads as a different kind of line
      var bo = gx - s * F.retreat;
      var dashMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.9 });
      for (var z = -hz + 0.4; z < hz - 0.4; z += 1.6) {
        addStrip(g, bo, z, bo, Math.min(z + 0.9, hz), lw, dashMat);
      }
    });
    return g;
  }

  function buildGoal(F, side) {
    var g = new THREE.Group();
    var postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
    var r = 0.06, gw = F.goalW, gh = F.goalH, depth = 1.6;
    var postGeo = new THREE.CylinderGeometry(r, r, gh, 10);
    [-1, 1].forEach(function (t) {
      var p = new THREE.Mesh(postGeo, postMat);
      p.position.set(0, gh / 2, (t * gw) / 2);
      g.add(p);
    });
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, gw + 2 * r, 10), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, gh, 0);
    g.add(bar);
    // net: a grid of thin lines over back, top and sides
    var pts = [];
    var step = 0.25;
    function seg(a, b) { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    var hw = gw / 2;
    for (var z = -hw; z <= hw + 0.001; z += step) {
      seg([0, gh, z], [depth, gh * 0.75, z]);
      seg([depth, gh * 0.75, z], [depth, 0, z]);
    }
    for (var y = 0; y <= gh * 0.75 + 0.001; y += step) seg([depth, y, -hw], [depth, y, hw]);
    for (var d = 0; d <= depth + 0.001; d += step) {
      var top = gh - (gh * 0.25) * (d / depth);
      seg([d, top, -hw], [d, top, hw]);
      seg([d, 0, -hw], [d, top, -hw]);
      seg([d, 0, hw], [d, top, hw]);
    }
    for (var y2 = 0; y2 <= gh; y2 += step) {
      var dd = depth * Math.min(1, (gh - y2) / (gh * 0.25 + 0.0001));
      if (y2 <= gh * 0.75) dd = depth;
      seg([0, y2, -hw], [dd, y2, -hw]);
      seg([0, y2, hw], [dd, y2, hw]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    var net = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
    g.add(net);
    g.position.set(side * (F.L / 2), 0, 0);
    if (side < 0) g.rotation.y = Math.PI;
    return g;
  }

  function buildSky() {
    var geo = new THREE.SphereGeometry(400, 24, 16);
    var colors = [];
    var pos = geo.attributes.position;
    var top = new THREE.Color(0x4f9fe8), mid = new THREE.Color(0xbfe2ff), low = new THREE.Color(0xe9f4ff);
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 400;
      var c = y > 0.25 ? mid.clone().lerp(top, (y - 0.25) / 0.75) : low.clone().lerp(mid, PIQ.clamp((y + 0.05) / 0.3, 0, 1));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  }

  function buildClouds() {
    var tex = canvasTex(128, 64, function (g, w, h) {
      var grd;
      [[40, 36, 26], [70, 30, 30], [96, 38, 22], [60, 44, 24]].forEach(function (c) {
        grd = g.createRadialGradient(c[0], c[1], 2, c[0], c[1], c[2]);
        grd.addColorStop(0, 'rgba(255,255,255,0.95)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      });
    });
    var grp = new THREE.Group();
    for (var i = 0; i < 9; i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
      var a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      s.position.set(Math.cos(a) * 260, 60 + Math.random() * 50, Math.sin(a) * 260);
      var sc = 70 + Math.random() * 50;
      s.scale.set(sc, sc / 2, 1);
      grp.add(s);
    }
    return grp;
  }

  function buildSurroundings(F) {
    var g = new THREE.Group();
    // outer grass
    var outerTex = canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#3c8c41'; c.fillRect(0, 0, w, h);
      for (var k = 0; k < 4000; k++) {
        c.fillStyle = Math.random() < 0.5 ? 'rgba(20,60,20,0.12)' : 'rgba(180,230,140,0.08)';
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
    outerTex.wrapS = outerTex.wrapT = THREE.RepeatWrapping;
    outerTex.repeat.set(30, 30);
    var outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ map: outerTex }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    g.add(outer);

    // trees ring
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5232 });
    var leafMats = [0x2f7d3a, 0x3a8f3f, 0x27693a, 0x4c9a3e].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
    var trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
    var leafGeo = new THREE.ConeGeometry(3, 7, 7);
    var roundGeo = new THREE.IcosahedronGeometry(3.4, 0);
    for (var i = 0; i < 46; i++) {
      var a = (i / 46) * Math.PI * 2;
      var rx = F.L / 2 + 26 + Math.random() * 30, rz = F.W / 2 + 22 + Math.random() * 30;
      var x = Math.cos(a) * rx, z = Math.sin(a) * rz;
      var t = new THREE.Group();
      var trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 1.5; t.add(trunk);
      var round = Math.random() < 0.5;
      var leaf = new THREE.Mesh(round ? roundGeo : leafGeo, PIQ.pick(leafMats));
      leaf.position.y = round ? 5.4 : 6.2;
      t.add(leaf);
      var s = 0.8 + Math.random() * 0.7;
      t.scale.set(s, s, s);
      t.position.set(x, 0, z);
      g.add(t);
    }

    // low boards around the field so it reads as a real venue
    var boardMat = new THREE.MeshLambertMaterial({ color: 0x1d3b6e });
    var stripeMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
    var off = 5;
    [[0, -(F.W / 2 + off), F.L + 2 * off, 0], [0, F.W / 2 + off + 3, F.L + 2 * off, 0],
     [-(F.L / 2 + off), 0, F.W + 2 * off, 1], [F.L / 2 + off, 0, F.W + 2 * off, 1]].forEach(function (b, idx) {
      if (idx === 1) return; // leave the camera side open
      var m = new THREE.Mesh(new THREE.BoxGeometry(b[2], 0.8, 0.12), boardMat);
      m.position.set(b[0], 0.4, b[1]);
      if (b[3]) m.rotation.y = Math.PI / 2;
      g.add(m);
      var st = new THREE.Mesh(new THREE.BoxGeometry(b[2], 0.12, 0.13), stripeMat);
      st.position.set(b[0], 0.62, b[1]);
      if (b[3]) st.rotation.y = Math.PI / 2;
      g.add(st);
    });

    // team benches on the far side
    var benchMat = new THREE.MeshLambertMaterial({ color: 0x9aa4b4 });
    [-8, 8].forEach(function (x) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(5, 0.45, 0.6), benchMat);
      b.position.set(x, 0.23, -(F.W / 2 + 3));
      g.add(b);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 1.3), new THREE.MeshLambertMaterial({ color: 0x2c6cc9, transparent: true, opacity: 0.85 }));
      roof.position.set(x, 2.1, -(F.W / 2 + 3.2));
      g.add(roof);
    });

    // disc cones marking each end of the retreat lines
    var coneMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
    var coneGeo = new THREE.ConeGeometry(0.22, 0.28, 12);
    [-1, 1].forEach(function (s) {
      [-1, 1].forEach(function (t) {
        var c = new THREE.Mesh(coneGeo, coneMat);
        c.position.set(s * (F.L / 2 - F.retreat), 0.14, t * (F.W / 2 + 0.7));
        g.add(c);
      });
    });

    // corner flags
    var flagPole = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6);
    var flagMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, side: THREE.DoubleSide });
    var poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    [-1, 1].forEach(function (s) {
      [-1, 1].forEach(function (t) {
        var p = new THREE.Mesh(flagPole, poleMat);
        p.position.set(s * F.L / 2, 0.75, t * F.W / 2);
        g.add(p);
        var f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), flagMat);
        f.position.set(s * F.L / 2 + 0.2, 1.35, t * F.W / 2);
        g.add(f);
      });
    });
    return g;
  }

  PIQ.buildWorld = function (scene) {
    var F = PIQ.FIELD;
    scene.background = new THREE.Color(0xbfe2ff);
    scene.fog = new THREE.Fog(0xd8ecff, 140, 330);
    scene.add(buildSky());
    scene.add(buildClouds());

    var pitchTex = grassTexture(F.L + 8, F.W + 8);
    pitchTex.anisotropy = 4;
    var pitch = new THREE.Mesh(new THREE.PlaneGeometry(F.L + 8, F.W + 8), new THREE.MeshLambertMaterial({ map: pitchTex }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.name = 'pitch';
    scene.add(pitch);
    scene.add(buildLines(F));
    scene.add(buildGoal(F, 1));
    scene.add(buildGoal(F, -1));
    scene.add(buildSurroundings(F));

    var hemi = new THREE.HemisphereLight(0xdff1ff, 0x3f7a3a, 0.75);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff4e0, 0.95);
    sun.position.set(-40, 80, 30);
    scene.add(sun);
    return { pitch: pitch };
  };
})();
