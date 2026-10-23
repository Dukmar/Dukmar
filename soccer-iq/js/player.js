/* Pitch IQ — runs a lesson: a scene plus a list of "beats". Each beat shows a
   caption, draws arrows/zones/labels, and moves players and the ball.
   Beat fields (all optional):
     say      caption HTML
     cam      camera preset or {target,dist,theta,phi}
     move     {id:[x,z] | id}         players jog there ('away:F' for opponents)
     pass     {to:id|[x,z], from:id, lofted:h, delay:s, owner:true}
     dribble  {who:id, to:[x,z]}
     shoot    {to:[x,z], from:id, delay:s}
     arrows   [[from, to, kind, bend]]  kind: run | pass | dribble
     zones    [{at:[x,z], r, color, pulse} | {rect:[x1,z1,x2,z2], color}]
     links    [[idA, idB, color]]
     tags / think / calls   {id: text}
     rings    {id: color}
     pov      id  (first-person view from that player), scan: true to look around
     dur      motion time in seconds */
(function () {
  'use strict';
  var PIQ = window.PIQ;

  function LessonPlayer(stage, lesson, hooks) {
    this.stage = stage;
    this.lesson = lesson;
    this.hooks = hooks || {};
    this.i = -1;
    this.snaps = [];
    this.rings = [];
    this.talk = (PIQ.TALK && PIQ.TALK.lessons[lesson.id]) || [];
    PIQ.buildScene(stage, lesson.scene, { instantCamera: true });
    if (lesson.scene.camera) stage.setCamera(lesson.scene.camera, true);
  }

  LessonPlayer.prototype.count = function () { return this.lesson.beats.length; };

  LessonPlayer.prototype.go = function (i) {
    var st = this.stage;
    if (i < 0 || i >= this.count()) return;
    st.finishAll();
    if (i <= this.i) {
      // going back (or replaying): restore the state from the start of that beat
      st.restore(this.snaps[i]);
    } else {
      // going forward: capture the state at the start of each beat on the way
      for (var k = this.i + 1; k <= i; k++) {
        if (k < i) { this.snaps[k] = st.snapshot(); this._run(this.lesson.beats[k], true, k); st.finishAll(); }
      }
      this.snaps[i] = st.snapshot();
    }
    this.i = i;
    this._run(this.lesson.beats[i], false, i);
    if (this.hooks.onBeat) this.hooks.onBeat(i, this.lesson.beats[i]);
  };
  LessonPlayer.prototype.next = function () { this.go(this.i + 1); };
  LessonPlayer.prototype.prev = function () { this.go(this.i - 1); };
  LessonPlayer.prototype.replay = function () { this.go(this.i); };

  LessonPlayer.prototype._clearBeat = function () {
    var st = this.stage;
    st.clearAnnotations();
    st.clearLabels(true);
    this.rings.forEach(function (p) { if (!st.labels.some(function (l) { return l.target === p.id && /you/.test(l.el.className); })) p.ring.visible = false; });
    this.rings = [];
    if (this._scanTimer) { clearInterval(this._scanTimer); this._scanTimer = null; }
  };

  LessonPlayer.prototype._run = function (b, silent, idx) {
    var st = this.stage, self = this;
    var P = function (ref) { return PIQ.pt(st, ref); };
    this._clearBeat();
    var dur = b.dur || 1.6;

    if (!silent) {
      if (b.pov) {
        st.setPOV(b.pov, b.povLook ? P(b.povLook) : null);
        if (b.scan) {
          var t0 = Date.now();
          this._scanTimer = setInterval(function () {
            if (!st.pov) return;
            var e = (Date.now() - t0) / 1000;
            st.pov.yaw = e < 3.6 ? Math.sin(e * 1.75) * 2.2 : 0;
            if (e > 3.8) { clearInterval(self._scanTimer); self._scanTimer = null; }
          }, 30);
        }
      } else if (b.cam) st.setCamera(b.cam);
      else if (st.pov) st.setCamera(this.lesson.scene.camera || 'broadcast');
    }

    // annotations
    (b.zones || []).forEach(function (z) {
      if (z.rect) st.zone(z.rect, null, { color: z.color, opacity: z.opacity });
      else st.zone(P(z.at), z.r || 3, { color: z.color, pulse: z.pulse, opacity: z.opacity });
    });
    (b.arrows || []).forEach(function (a) {
      var from = P(a[0]), to = P(a[1]);
      var col = a[4] === 'bad' ? PIQ.COLORS.bad : a[4] === 'good' ? PIQ.COLORS.good : a[4];
      if (from && to) st.arrow(from, to, a[2] || 'run', { color: col, bend: a[3] || 0, startCut: typeof a[0] === 'string' ? 0.7 : 0.1, endCut: typeof a[1] === 'string' && a[1] !== 'goal' && a[1] !== 'ourgoal' ? 0.8 : 0.1 });
    });
    (b.links || []).forEach(function (l) { st.link(l[0], l[1], l[2]); });
    function labels(map, cls) {
      if (!map) return;
      Object.keys(map).forEach(function (id) { st.label(id, map[id], cls); });
    }
    if (!silent) {
      labels(b.tags, 'tag');
      labels(b.think, 'think');
      labels(b.calls, 'call');
      (b.notes || []).forEach(function (n) { st.label(n[0], n[1], n[2] || 'tag', { y: n[3] || 0.6 }); });
      // players talking to her
      this.talk.forEach(function (t) {
        if (t[0] !== idx) return;
        st.after(t[3] != null ? t[3] : 0.25, function () { PIQ.say(st, t[1], t[2], 3.6); });
      });
      if (idx === 0 && !this.talk.some(function (t) { return t[0] === 0; })) st.after(0.4, function () { PIQ.chat(st, 'lessonStart'); });
    }
    if (b.rings) Object.keys(b.rings).forEach(function (id) {
      var p = st.players[id];
      var c = b.rings[id];
      c = c === 'bad' ? PIQ.COLORS.bad : c === 'good' ? PIQ.COLORS.good : c === true ? PIQ.COLORS.info : c;
      if (p) { PIQ.setRing(p, c, true); self.rings.push(p); }
    });

    // motion
    var wait = b.wait || 0;
    if (b.move) {
      Object.keys(b.move).forEach(function (id) {
        var to = P(b.move[id]);
        if (!to) return;
        var p = st.players[id];
        var d = p ? PIQ.dist(p.pos, to) : 0;
        st.after(wait, function () { st.moveTo(id, to, b.runTime || Math.max(dur, d / 6.5)); });
      });
    }
    if (b.dribble) {
      st.after(wait, function () {
        var who = b.dribble.who || (st.ball.owner && st.ball.owner.id);
        if (!who) return;
        st.giveBall(who);
        st.players[who].faceBall = false;
        st.moveTo(who, P(b.dribble.to), b.dribble.dur || dur);
      });
    }
    if (b.pass) {
      st.after(wait + (b.pass.delay || 0), function () {
        var to = P(b.pass.to);
        var ownerId = typeof b.pass.to === 'string' && st.players[b.pass.to] ? b.pass.to : null;
        if (b.pass.from && st.players[b.pass.from]) st.giveBall(b.pass.from);
        var from = st.ball.owner;
        if (from) {
          from.faceBall = true;
          from.heading = Math.atan2(to[0] - from.pos[0], to[1] - from.pos[1]);
          from.obj.rotation.y = from.heading;
          st._carryBall();
        }
        var dest = to.slice();
        if (ownerId) {
          // aim just in front of the receiver
          var r = st.players[ownerId];
          var hd = Math.atan2(st.ball.pos[0] - r.pos[0], st.ball.pos[1] - r.pos[1]);
          dest = [r.pos[0] + Math.sin(hd) * 0.6, r.pos[1] + Math.cos(hd) * 0.6];
        }
        st.kickBall(dest, { height: b.pass.lofted || 0, dur: b.pass.dur, owner: ownerId, silent: silent, onDone: function () {
          if (ownerId) { var rp = st.players[ownerId]; rp.faceBall = false; rp.heading = rp.team === 'home' ? Math.PI / 2 : -Math.PI / 2; }
        } });
      });
    }
    if (b.shoot) {
      st.after(wait + (b.shoot.delay || 0), function () {
        if (b.shoot.from && st.players[b.shoot.from]) st.giveBall(b.shoot.from);
        var to = b.shoot.to || [PIQ.FIELD.L / 2 + 0.6, (Math.random() - 0.5) * 3];
        st.kickBall(to, { height: b.shoot.lofted || 0.4, dur: 0.7, silent: silent, onDone: function () {
          if (!silent && b.shoot.goal !== false) { PIQ.sfx.cheer(); }
        } });
      });
    }
    if (b.giveTo) st.after(wait, function () { st.giveBall(b.giveTo); });
    if (b.hideBall) st.ball.obj.visible = false;
    if (b.showBall) st.ball.obj.visible = true;
    if (b.whistle && !silent) PIQ.sfx.whistle();
  };

  LessonPlayer.prototype.destroy = function () {
    this._clearBeat();
    this.stage.speedScale = 1;
  };

  PIQ.LessonPlayer = LessonPlayer;
})();
