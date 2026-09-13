/* field.js — the background that never stops moving: dust driven by live Port Said
   PM2.5 (how many) and wind (how fast). The pointer works as a detector. */
(function () {
  "use strict";

  var ME = window.ME;
  var TAU = Math.PI * 2;
  var WIND_ANGLE = 0.21; // mostly left → right, drifting slightly down
  var PICK_EVERY_MS = 140;

  var canvas, ctx;
  var W = 0, H = 0, DPR = 1;
  var particles = [];
  var detections = [];
  var air = { pm25: 16.5, pm10: 28.7, windKmh: 11.7 };
  var ink = "244, 244, 242";
  var detColor = "#FFC42E";
  var tagInk = "#14213D";
  var pointer = { x: 0, y: 0, seen: 0, touch: false };
  var lastPick = 0;
  var lastScroll = 0;
  var quality = 1;
  var slow = 0;
  var removeTick = null;

  function targetCount() {
    var area = Math.sqrt((W * H) / (1440 * 900));
    var density = ME.clamp(air.pm25 / 15, 0.6, 2.4); // 15 µg/m³ = WHO 24-hour guideline
    var base = ME.finePointer() ? 150 : 85;
    return Math.round(ME.clamp(base * density * area * quality, 36, 340));
  }

  function coarseShare() {
    if (!air.pm10 || air.pm10 <= air.pm25) return 0.06;
    return ME.clamp((air.pm10 - air.pm25) / air.pm10, 0.06, 0.6) * 0.35;
  }

  function spawn(p) {
    p = p || {};
    var coarse = Math.random() < coarseShare();
    p.x = Math.random() * W;
    p.y = Math.random() * H;
    p.z = ME.rand(0.35, 1);
    p.r = (coarse ? ME.rand(1.7, 2.9) : ME.rand(0.55, 1.5)) * (0.55 + p.z * 0.45);
    p.a = (coarse ? ME.rand(0.12, 0.26) : ME.rand(0.22, 0.58)) * (0.55 + p.z * 0.45);
    p.seed = Math.random() * 1000;
    p.kind = coarse ? "pm10" : "pm2.5";
    return p;
  }

  function fitCount() {
    var n = targetCount();
    while (particles.length < n) particles.push(spawn());
    if (particles.length > n) {
      var removed = particles.splice(n);
      detections = detections.filter(function (d) { return removed.indexOf(d.p) === -1; });
    }
  }

  function readColors() {
    ink = ME.cssVar("--field-rgb") || ink;
    detColor = ME.cssVar("--det") || detColor;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fitCount();
  }

  /* ---------- detections ---------- */
  function focusPoint(t, now) {
    var idle = now - pointer.seen > (pointer.touch ? 1400 : 3500);
    if (pointer.seen && !idle) return { x: pointer.x, y: pointer.y, scanner: false };
    return {
      x: W * (0.5 + 0.38 * Math.sin(t * 0.13)),
      y: H * (0.5 + 0.3 * Math.sin(t * 0.19 + 1.3)),
      scanner: true
    };
  }

  function pick(focus) {
    var R = focus.scanner ? 230 : 170;
    var R2 = R * R;
    var near = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var dx = p.x - focus.x, dy = p.y - focus.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < R2) near.push([d2, p]);
    }
    near.sort(function (a, b) { return a[0] - b[0]; });
    var max = ME.finePointer() ? 3 : 2;
    var chosen = near.slice(0, max).map(function (n) { return n[1]; });
    detections.forEach(function (d) { d.want = chosen.indexOf(d.p) > -1; });
    chosen.forEach(function (p) {
      var have = detections.some(function (d) { return d.p === p; });
      if (!have) detections.push({ p: p, x: p.x, y: p.y, alpha: 0, want: true, conf: 0.6 });
    });
  }

  function bracket(x, y, s, alpha) {
    var l = Math.max(5, s * 0.32);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = detColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
    ctx.moveTo(x + s - l, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + l);
    ctx.moveTo(x + s, y + s - l); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - l, y + s);
    ctx.moveTo(x + l, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s - l);
    ctx.stroke();
  }

  function tag(x, y, text, alpha) {
    ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
    var w = ctx.measureText(text).width + 10;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = detColor;
    ctx.fillRect(x, y - 15, w, 15);
    ctx.fillStyle = tagInk;
    ctx.fillText(text, x + 5, y - 4);
  }

  function drawDetections(dt, focus) {
    for (var i = detections.length - 1; i >= 0; i--) {
      var d = detections[i];
      d.alpha = ME.clamp(d.alpha + (d.want ? dt * 6 : -dt * 4), 0, 1);
      if (!d.want && d.alpha <= 0) { detections.splice(i, 1); continue; }
      d.x = ME.lerp(d.x, d.p.x, 0.4);
      d.y = ME.lerp(d.y, d.p.y, 0.4);
      var dist = Math.hypot(d.p.x - focus.x, d.p.y - focus.y);
      var target = 0.55 + 0.44 * ME.clamp(1 - dist / 230, 0, 1);
      d.conf = ME.lerp(d.conf, target + (Math.random() - 0.5) * 0.02, 0.12);
      var s = 14 + d.p.r * 8;
      bracket(d.x - s / 2, d.y - s / 2, s, d.alpha);
      tag(d.x - s / 2, d.y - s / 2 - 3, d.p.kind + " " + ME.clamp(d.conf, 0, 0.99).toFixed(2), d.alpha);
    }
    if (focus.scanner) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = detColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(focus.x, focus.y, 22, 0, TAU);
      ctx.moveTo(focus.x - 30, focus.y); ctx.lineTo(focus.x - 14, focus.y);
      ctx.moveTo(focus.x + 14, focus.y); ctx.lineTo(focus.x + 30, focus.y);
      ctx.moveTo(focus.x, focus.y - 30); ctx.lineTo(focus.x, focus.y - 14);
      ctx.moveTo(focus.x, focus.y + 14); ctx.lineTo(focus.x, focus.y + 30);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- frame ---------- */
  function drawParticles(dt, t, scrollDelta) {
    var speed = 6 + air.windKmh * 1.1;
    var vx = Math.cos(WIND_ANGLE) * speed;
    var vy = Math.sin(WIND_ANGLE) * speed;
    ctx.fillStyle = "rgb(" + ink + ")";
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (dt) {
        var swirlX = Math.sin(p.y * 0.0042 + t * 0.21 + p.seed) * 7;
        var swirlY = Math.cos(p.x * 0.0031 + t * 0.17 + p.seed) * 5;
        p.x += (vx + swirlX) * p.z * dt;
        p.y += (vy + swirlY) * p.z * dt - scrollDelta * p.z * 0.12;
        if (p.x > W + 12) p.x = -12; else if (p.x < -12) p.x = W + 12;
        if (p.y > H + 12) p.y = -12; else if (p.y < -12) p.y = H + 12;
      }
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(dt, now) {
    // adapt particle count if the device struggles
    if (dt > 1 / 40) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 90 && quality > 0.45) {
      quality *= 0.8;
      slow = 0;
      fitCount();
    }

    var t = now / 1000;
    var sy = window.scrollY;
    var scrollDelta = ME.clamp(sy - lastScroll, -200, 200);
    lastScroll = sy;

    ctx.clearRect(0, 0, W, H);
    drawParticles(dt, t, scrollDelta);

    var focus = focusPoint(t, now);
    if (now - lastPick > PICK_EVERY_MS) {
      lastPick = now;
      pick(focus);
    }
    drawDetections(dt, focus);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    drawParticles(0, 0, 0);
  }

  function applyAir(state) {
    var c = state && state.portSaid;
    if (!c) return;
    air.pm25 = c.pm25;
    air.pm10 = c.pm10 === null ? c.pm25 : c.pm10;
    air.windKmh = c.windKmh === null ? 10 : c.windKmh;
    particles.forEach(function (p) { spawn(p); });
    fitCount();
    if (!removeTick) drawStatic();
  }

  function init() {
    canvas = document.getElementById("field");
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext("2d");
    readColors();
    resize();
    lastScroll = window.scrollY;

    window.addEventListener("resize", function () {
      resize();
      if (!removeTick) drawStatic();
    });

    window.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.touch = e.pointerType !== "mouse";
      pointer.seen = performance.now();
    }, { passive: true });
    window.addEventListener("pointerdown", function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.touch = e.pointerType !== "mouse";
      pointer.seen = performance.now();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { pointer.seen = 0; });

    ME.bus.on("theme", function () {
      readColors();
      if (!removeTick) drawStatic();
    });

    ME.air.ready.then(applyAir);

    if (ME.reducedMotion()) drawStatic();
    else removeTick = ME.ticker.add(frame);
  }

  ME.field = {
    init: init,
    count: function () { return particles.length; },
    detections: function () { return detections.length; },
    air: function () { return { pm25: air.pm25, pm10: air.pm10, windKmh: air.windKmh }; }
  };
})();
