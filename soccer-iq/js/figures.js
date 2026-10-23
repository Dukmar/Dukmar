/* Pitch IQ — low-poly players and the ball.
   A player faces local +Z; rotation.y = atan2(dx, dz) turns her toward (dx, dz). */
(function () {
  'use strict';
  var PIQ = window.PIQ;

  var SKIN = [0xf1c7a5, 0xe0ac86, 0xc68a5e, 0x9a6440, 0x6e4529, 0xf6d6bd];
  var HAIR = [0x2b1c12, 0x4a2f1b, 0x7a4a24, 0xd8a94e, 0xedd08a, 0x141414, 0xa8471f, 0x5b3a22];

  PIQ.TEAMS = {
    home: { name: 'Us', shirt: 0x2f5bea, shorts: 0x1b2a55, socks: 0x2f5bea, text: '#ffffff', keeper: 0x19c37d },
    away: { name: 'Them', shirt: 0xe8453c, shorts: 0xffffff, socks: 0xe8453c, text: '#ffffff', keeper: 0x8e44ad }
  };
  PIQ.JERSEYS = [
    { id: 'blue', label: 'Blue', shirt: 0x2f5bea, shorts: 0x1b2a55 },
    { id: 'purple', label: 'Purple', shirt: 0x7b3fe4, shorts: 0x2a1650 },
    { id: 'pink', label: 'Pink', shirt: 0xff4fa3, shorts: 0x2b2b2b },
    { id: 'teal', label: 'Teal', shirt: 0x12a7a0, shorts: 0x0c3b3a },
    { id: 'yellow', label: 'Yellow', shirt: 0xffc928, shorts: 0x1e1e1e, text: '#1e1e1e' },
    { id: 'black', label: 'Black', shirt: 0x1f1f24, shorts: 0x1f1f24 }
  ];

  function hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  function shirtTexture(color, num, textColor) {
    return PIQ.canvasTex(256, 128, function (g, w, h) {
      g.fillStyle = hex(color); g.fillRect(0, 0, w, h);
      // subtle side panels
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(w * 0.47, 0, w * 0.06, h);
      g.fillRect(w * 0.97, 0, w * 0.03, h);
      g.fillRect(0, 0, w * 0.03, h);
      g.fillStyle = textColor || '#ffffff';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 74px Arial, Helvetica, sans-serif';
      g.fillText(String(num), w * 0.75, h * 0.52); // back
      g.font = 'bold 30px Arial, Helvetica, sans-serif';
      g.fillText(String(num), w * 0.21, h * 0.36); // front, over the heart
    });
  }

  var shared = null;
  function geos() {
    if (shared) return shared;
    shared = {
      torso: new THREE.CylinderGeometry(0.2, 0.17, 0.5, 16, 1, false, -Math.PI / 2, Math.PI * 2),
      shorts: new THREE.CylinderGeometry(0.175, 0.19, 0.2, 12),
      leg: new THREE.CylinderGeometry(0.065, 0.055, 0.62, 8),
      sock: new THREE.CylinderGeometry(0.07, 0.06, 0.3, 8),
      shoe: new THREE.BoxGeometry(0.11, 0.08, 0.22),
      arm: new THREE.CylinderGeometry(0.05, 0.045, 0.48, 8),
      head: new THREE.SphereGeometry(0.15, 16, 12),
      hair: new THREE.SphereGeometry(0.168, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      hairBack: new THREE.SphereGeometry(0.17, 16, 12, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.35, Math.PI * 0.4),
      longHair: new THREE.CylinderGeometry(0.16, 0.17, 0.3, 14, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      pony: new THREE.SphereGeometry(0.075, 10, 8),
      bun: new THREE.SphereGeometry(0.085, 10, 8),
      shadow: new THREE.CircleGeometry(0.42, 20),
      ring: new THREE.RingGeometry(0.5, 0.62, 32),
      hit: new THREE.CylinderGeometry(0.55, 0.55, 1.6, 8)
    };
    return shared;
  }

  var shadowTex = null;
  function blobShadow() {
    if (!shadowTex) {
      shadowTex = PIQ.canvasTex(64, 64, function (g) {
        var grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        grd.addColorStop(0, 'rgba(0,0,0,0.45)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      });
    }
    var m = new THREE.Mesh(geos().shadow, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.015;
    return m;
  }

  // opts: { team:'home'|'away', num, role:'GK'|..., id }
  PIQ.makePlayer = function (opts) {
    var G = geos();
    var team = PIQ.TEAMS[opts.team] || PIQ.TEAMS.home;
    var isGK = opts.role === 'GK';
    // keepers wear the team colour here so it's always clear who is on which team;
    // bright gloves mark them out (real 7v7 keepers wear a different colour)
    var shirtColor = team.shirt;
    var seed = (opts.num || 1) * 7 + (opts.team === 'away' ? 3 : 0);
    var skin = new THREE.MeshLambertMaterial({ color: SKIN[seed % SKIN.length] });
    var hairMat = new THREE.MeshLambertMaterial({ color: HAIR[(seed * 3) % HAIR.length] });
    var shirtMat = new THREE.MeshLambertMaterial({ map: shirtTexture(shirtColor, opts.num || '', team.text) });
    var plainShirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    var shortsMat = new THREE.MeshLambertMaterial({ color: team.shorts });
    var sockMat = new THREE.MeshLambertMaterial({ color: team.socks });
    var shoeMat = new THREE.MeshLambertMaterial({ color: 0x15151a });
    var gloveMat = new THREE.MeshLambertMaterial({ color: 0xd7f24a, emissive: 0x2a3000 });

    var root = new THREE.Group();
    var body = new THREE.Group(); // bobs while running
    root.add(body);

    var hips = 0.78;
    var legs = [];
    [-1, 1].forEach(function (s) {
      var pivot = new THREE.Group();
      pivot.position.set(s * 0.09, hips, 0);
      var leg = new THREE.Mesh(G.leg, skin); leg.position.y = -0.31; pivot.add(leg);
      var sock = new THREE.Mesh(G.sock, sockMat); sock.position.y = -0.5; pivot.add(sock);
      var shoe = new THREE.Mesh(G.shoe, shoeMat); shoe.position.set(0, -0.73, 0.04); pivot.add(shoe);
      body.add(pivot);
      legs.push(pivot);
    });
    var shorts = new THREE.Mesh(G.shorts, shortsMat); shorts.position.y = hips + 0.04; body.add(shorts);
    var torso = new THREE.Mesh(G.torso, shirtMat); torso.position.y = hips + 0.38; body.add(torso);
    var arms = [];
    [-1, 1].forEach(function (s) {
      var pivot = new THREE.Group();
      pivot.position.set(s * 0.24, hips + 0.6, 0);
      var sleeve = new THREE.Mesh(G.arm, plainShirt); sleeve.scale.set(1.15, 0.35, 1.15); sleeve.position.y = -0.07; pivot.add(sleeve);
      var arm = new THREE.Mesh(G.arm, skin); arm.position.y = -0.24; pivot.add(arm);
      if (isGK) {
        var glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), gloveMat);
        glove.position.y = -0.5; pivot.add(glove);
      }
      pivot.rotation.z = s * 0.12;
      body.add(pivot);
      arms.push(pivot);
    });
    var head = new THREE.Group();
    head.position.y = hips + 0.8;
    head.add(new THREE.Mesh(G.head, skin));
    // hair: a full cap plus one of five styles, picked from the shirt number
    var hair = new THREE.Mesh(G.hair, hairMat); hair.rotation.x = -0.4; hair.position.set(0, 0.015, -0.015); head.add(hair);
    var back = new THREE.Mesh(G.hairBack, hairMat); back.rotation.y = Math.PI; head.add(back);
    var pony = new THREE.Group();
    var style = (seed * 5 + 1) % 5;
    if (style === 0 || style === 4) { // high ponytail (4: with a bright scrunchie)
      pony.position.set(0, 0.08, -0.16);
      pony.add(new THREE.Mesh(G.pony, hairMat));
      var tail = new THREE.Mesh(G.pony, hairMat); tail.scale.set(0.9, 2.2, 0.9); tail.position.set(0, -0.15, -0.05); pony.add(tail);
      if (style === 4) {
        var tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 12), new THREE.MeshLambertMaterial({ color: opts.team === 'away' ? 0xffffff : 0xffe14d }));
        tie.position.set(0, -0.02, -0.02); tie.rotation.x = Math.PI / 2; pony.add(tie);
      }
    } else if (style === 1) { // two pigtails
      pony.position.set(0, 0.02, -0.08);
      [-1, 1].forEach(function (s) {
        var pt = new THREE.Mesh(G.pony, hairMat); pt.scale.set(0.8, 1.9, 0.8); pt.position.set(s * 0.15, -0.1, -0.02); pony.add(pt);
      });
    } else if (style === 2) { // long hair down the back
      var lh = new THREE.Mesh(G.longHair, hairMat); lh.position.set(0, -0.12, 0); head.add(lh);
      pony.position.set(0, -0.16, -0.12);
      var tip = new THREE.Mesh(G.pony, hairMat); tip.scale.set(1.9, 0.9, 0.7); pony.add(tip);
    } else { // bun on top
      pony.position.set(0, 0.16, -0.06);
      pony.add(new THREE.Mesh(G.bun, hairMat));
    }
    head.add(pony);
    body.add(head);

    var shadow = blobShadow();
    root.add(shadow);

    // selection ring (hidden until needed)
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95, depthWrite: false });
    var ring = new THREE.Mesh(G.ring, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.visible = false;
    root.add(ring);

    // invisible fat cylinder for easy tapping on phones
    var hit = new THREE.Mesh(G.hit, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.8;
    root.add(hit);

    var p = {
      id: opts.id, team: opts.team, num: opts.num, role: opts.role || '', label: opts.label || '',
      obj: root, hit: hit, ring: ring, legs: legs, arms: arms, body: body, pony: pony,
      pos: [0, 0], target: null, from: null, t0: 0, dur: 0,
      heading: opts.team === 'away' ? -Math.PI / 2 : Math.PI / 2,
      speed: 0, phase: Math.random() * 6, idle: Math.random() * 6,
      draggable: false, faceBall: true
    };
    hit.userData.player = p;
    root.rotation.y = p.heading;
    root.scale.set(PIQ.FIG_SCALE, PIQ.FIG_SCALE, PIQ.FIG_SCALE);
    return p;
  };

  PIQ.setRing = function (p, color, on) {
    p.ring.visible = on !== false;
    if (color != null) p.ring.material.color.setHex(color);
  };

  PIQ.setPlayerPos = function (p, x, z) {
    p.pos[0] = x; p.pos[1] = z;
    p.obj.position.set(x, 0, z);
  };

  // per-frame animation: run cycle when moving, gentle idle sway when not
  PIQ.animatePlayer = function (p, dt, lookAt) {
    var moving = p.speed > 0.4;
    var k = Math.min(p.speed, 7);
    if (moving) {
      p.phase += dt * (5 + k * 1.3);
      var sw = Math.sin(p.phase) * (0.35 + k * 0.06);
      p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
      p.arms[0].rotation.x = -sw * 0.9; p.arms[1].rotation.x = sw * 0.9;
      p.body.position.y = Math.abs(Math.cos(p.phase)) * 0.05;
      p.body.rotation.x = 0.12;
      p.pony.rotation.x = 0.3 + Math.sin(p.phase * 2) * 0.25;
    } else {
      p.idle += dt * 2;
      p.legs[0].rotation.x *= 0.8; p.legs[1].rotation.x *= 0.8;
      p.arms[0].rotation.x = Math.sin(p.idle) * 0.05; p.arms[1].rotation.x = -Math.sin(p.idle) * 0.05;
      p.body.position.y = Math.sin(p.idle * 1.5) * 0.012 + 0.012;
      p.body.rotation.x *= 0.85;
      p.pony.rotation.x = Math.sin(p.idle) * 0.08;
    }
    var want = p.heading;
    if (!moving && lookAt && p.faceBall) {
      want = Math.atan2(lookAt[0] - p.pos[0], lookAt[1] - p.pos[1]);
    }
    var cur = p.obj.rotation.y;
    var d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.obj.rotation.y = cur + d * Math.min(1, dt * 8);
    if (p.ring.visible) {
      var s = 1 + Math.sin(Date.now() / 220) * 0.08;
      p.ring.scale.set(s, s, s);
    }
  };

  // ---------- ball ----------
  function ballTexture() {
    return PIQ.canvasTex(256, 128, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b1b22';
      var spots = [[30, 30], [95, 64], [160, 30], [225, 64], [30, 100], [160, 100], [95, 4], [225, 124]];
      spots.forEach(function (s) {
        g.beginPath();
        for (var i = 0; i < 5; i++) {
          var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          var x = s[0] + Math.cos(a) * 16, y = s[1] + Math.sin(a) * 13;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath(); g.fill();
      });
      g.fillStyle = '#ff4fa3';
      g.fillRect(0, 60, w, 6);
    });
  }

  PIQ.FIG_SCALE = 1.35; // players drawn a bit larger than life so they read on a phone
  PIQ.HEAD_TOP = 2.0 * PIQ.FIG_SCALE; // top of the tallest hairstyle, for placing bubbles
  PIQ.BALL_R = 0.21;    // same for the ball (a real size 4 is about 0.1 m)
  PIQ.makeBall = function () {
    var R = PIQ.BALL_R;
    var root = new THREE.Group();
    var ball = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshLambertMaterial({ map: ballTexture() }));
    ball.position.y = R;
    root.add(ball);
    var sh = blobShadow();
    sh.scale.set(0.45, 0.45, 0.45);
    root.add(sh);
    var hit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.4;
    root.add(hit);
    var b = { obj: root, mesh: ball, shadow: sh, hit: hit, pos: [0, 0], h: 0, owner: null, draggable: false, isBall: true };
    hit.userData.ball = b;
    return b;
  };
  PIQ.setBallPos = function (b, x, z, h) {
    var dx = x - b.pos[0], dz = z - b.pos[1];
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.0001 && d < 5) {
      // roll: rotate around the axis perpendicular to travel
      var axis = new THREE.Vector3(dz, 0, -dx).normalize();
      b.mesh.rotateOnWorldAxis(axis, d / PIQ.BALL_R);
    }
    b.pos[0] = x; b.pos[1] = z; b.h = h || 0;
    b.obj.position.set(x, 0, z);
    b.mesh.position.y = PIQ.BALL_R + b.h;
    var s = 0.45 * Math.max(0.4, 1 - b.h / 6);
    b.shadow.scale.set(s, s, s);
  };
})();
