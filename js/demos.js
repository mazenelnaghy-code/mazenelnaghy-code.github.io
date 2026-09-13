/* demos.js — the live mini-demos inside each project detection.
   ME.demos.mount(kind, stageEl, { interactive }) -> { destroy() }
   kinds: "aqi" (live air bars), "dog" (detector + deterrent), "ball" (tracker), "schema" (ER diagram) */
(function () {
  "use strict";

  var ME = window.ME;
  var SVGNS = "http://www.w3.org/2000/svg";
  var AMBER = "#FFC42E", AMBER_HI = "#FFD563", AMBER_LO = "#E0A800", NAVY = "#14213D";
  var PAPER = "244, 244, 242";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* run fn on the shared ticker only while the stage is on screen (and, for card demos,
     while no project dialog is covering the grid) */
  function whileVisible(stage, interactive, fn) {
    var remove = null, visible = false;
    function sync() {
      var coveredCard = !interactive && document.documentElement.classList.contains("is-dialog-open");
      var run = visible && !coveredCard && !ME.reducedMotion();
      if (run && !remove) remove = ME.ticker.add(fn);
      else if (!run && remove) { remove(); remove = null; }
    }
    var stopIO = ME.onVisible(stage, function (v) { visible = v; sync(); }, { threshold: 0.02 });
    ME.bus.on("dialog", sync);
    return function () {
      stopIO();
      ME.bus.off("dialog", sync);
      if (remove) remove();
      remove = null;
    };
  }

  /* ======================================================================
     AQI — live US AQI for all eight cities, worst first, Port Said highlighted
     ====================================================================== */
  function aqi(stage, opts) {
    var root = document.createElement("div");
    root.className = "aqi" + (opts.interactive ? " is-interactive" : "");
    root.innerHTML =
      '<p class="stage-hud"><span class="live-dot" aria-hidden="true"></span><span class="aqi-src">connecting to pipeline…</span></p>' +
      '<p class="stage-hud stage-hud-r">US AQI · worst first</p>' +
      '<ol class="aqi-list" aria-label="Latest US AQI by city"></ol>' +
      '<p class="aqi-foot"><span class="aqi-ref-key" aria-hidden="true"></span>100 = unhealthy for sensitive groups</p>';
    stage.appendChild(root);
    var dead = false;

    ME.air.ready.then(function (state) {
      if (dead) return;
      var cities = state.cities.slice().sort(function (a, b) { return b.aqi - a.aqi; });
      var max = Math.max(200, Math.ceil(cities[0].aqi / 50) * 50);
      root.style.setProperty("--ref", (100 / max).toFixed(4));
      var observed = ME.air.timeLocal(state.portSaid.observedAt);
      root.querySelector(".aqi-src").textContent =
        (state.source === "live" ? "live" : "sample") + " · Port Said " + observed + " local";

      root.querySelector(".aqi-list").innerHTML = cities.map(function (c) {
        var home = c.id === "port_said";
        var tip = esc(c.name) + " · US AQI " + Math.round(c.aqi) + " (" + esc(c.category) + ") · PM2.5 " +
          c.pm25.toFixed(1) + " µg/m³" + (c.pm10 === null ? "" : " · PM10 " + c.pm10.toFixed(1)) +
          " · " + ME.air.timeLocal(c.observedAt) + " local";
        return '<li class="aqi-row' + (home ? " is-home" : "") + '"' + (opts.interactive ? ' tabindex="0"' : "") + ">" +
          '<span class="aqi-city">' + esc(c.name) + (home ? '<span class="aqi-here"><i aria-hidden="true"></i>here</span>' : "") + "</span>" +
          '<span class="aqi-track" aria-hidden="true"><i style="--w:' + (c.aqi / max).toFixed(4) + '"></i></span>' +
          '<span class="aqi-val">' + Math.round(c.aqi) + "</span>" +
          (opts.interactive ? '<span class="aqi-tip" role="tooltip">' + tip + "</span>" : "") +
          "</li>";
      }).join("");

      var grow = function () { root.classList.add("is-on"); };
      if (ME.reducedMotion()) grow();
      else {
        var stop = ME.onVisible(root, function (v) {
          if (!v) return;
          setTimeout(grow, 120);
          if (stop) stop();
        }, { threshold: 0.3 });
      }
    });

    return { destroy: function () { dead = true; root.remove(); } };
  }

  /* ======================================================================
     DOG — camera on a pole spots a dog, confidence climbs, speaker fires, dog leaves
     ====================================================================== */
  var DOG_SVG =
    '<svg class="dog" viewBox="0 0 480 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<polygon class="dog-fov" points="142,92 480,118 480,236 252,236"/>' +
      '<line class="dog-ground" x1="0" y1="236.5" x2="480" y2="236.5"/>' +
      '<g class="dog-gate">' +
        '<path d="M14 236V148M34 236V148M54 236V148M74 236V148M94 236V148M8 156H100M8 210H100"/>' +
      "</g>" +
      '<line class="dog-pole" x1="122" y1="236" x2="122" y2="100"/>' +
      '<g class="dog-cam"><rect x="102" y="80" width="44" height="26" rx="4"/><circle class="dog-lens" cx="138" cy="93" r="6"/><circle class="dog-led" cx="110" cy="88" r="2.4"/></g>' +
      '<g class="dog-speaker"><path d="M110 118h10l12-9v30l-12-9h-10z"/></g>' +
      '<g class="dog-waves"><path d="M140 114a14 14 0 0 1 0 20"/><path d="M148 106a26 26 0 0 1 0 36"/><path d="M156 98a38 38 0 0 1 0 52"/></g>' +
      '<g class="dog-body" transform="translate(560 236)">' +
        '<path class="dog-tail" d="M32 -40 Q48 -52 45 -68"/>' +
        '<line class="dog-leg dog-leg-a" x1="-20" y1="-28" x2="-20" y2="-2"/>' +
        '<line class="dog-leg dog-leg-b" x1="-11" y1="-28" x2="-11" y2="-2"/>' +
        '<line class="dog-leg dog-leg-b" x1="18" y1="-28" x2="18" y2="-2"/>' +
        '<line class="dog-leg dog-leg-a" x1="27" y1="-28" x2="27" y2="-2"/>' +
        '<rect x="-30" y="-48" width="66" height="26" rx="13"/>' +
        '<path d="M-24 -42 L-40 -60 L-27 -67 L-12 -46 Z"/>' +
        '<circle cx="-40" cy="-64" r="11"/>' +
        '<rect x="-60" y="-65" width="20" height="10" rx="5"/>' +
        '<path d="M-43 -72 L-35 -86 L-31 -69 Z"/>' +
        '<circle class="dog-eye" cx="-44" cy="-67" r="1.8"/>' +
      "</g>" +
      '<g class="dog-det">' +
        '<path class="dog-box" d=""/>' +
        '<rect class="dog-tag-bg" x="0" y="0" width="74" height="16"/>' +
        '<text class="dog-tag" x="0" y="0">dog 0.00</text>' +
      "</g>" +
      '<text class="dog-alert" x="164" y="96">deterrent ▲ 2.4 kHz</text>' +
    "</svg>";

  var audioCtx = null;
  function chirp() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    var t = audioCtx.currentTime;
    [0, 0.2].forEach(function (offset) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2100, t + offset);
      osc.frequency.exponentialRampToValueAtTime(3400, t + offset + 0.14);
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.07, t + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.18);
    });
  }

  function dog(stage, opts) {
    var wrap = document.createElement("div");
    wrap.className = "dog-wrap";
    wrap.innerHTML = DOG_SVG +
      '<p class="stage-hud">cam 02 · yolo · 320 px input</p>' +
      '<p class="stage-hud stage-hud-r dog-stat">no detections</p>';
    stage.appendChild(wrap);

    var svg = wrap.querySelector("svg");
    var body = svg.querySelector(".dog-body");
    var legsA = svg.querySelectorAll(".dog-leg-a");
    var legsB = svg.querySelectorAll(".dog-leg-b");
    var det = svg.querySelector(".dog-det");
    var box = svg.querySelector(".dog-box");
    var tagBg = svg.querySelector(".dog-tag-bg");
    var tagText = svg.querySelector(".dog-tag");
    var stat = wrap.querySelector(".dog-stat");
    var soundOn = false;

    if (opts.interactive) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stage-ctl";
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-volume"/></svg><span>Deterrent sound: off</span>';
      btn.addEventListener("click", function () {
        soundOn = !soundOn;
        btn.setAttribute("aria-pressed", String(soundOn));
        btn.querySelector("span").textContent = "Deterrent sound: " + (soundOn ? "on" : "off");
        if (soundOn) chirp();
      });
      wrap.appendChild(btn);
    }

    var LOOP = 6.6;
    var clock = 0;
    var fired = false;

    // dog x, facing (1 = left, -1 = right), gait speed, phase flags for a time in the loop
    function pose(t) {
      if (t < 2.4) {
        var k = t / 2.4;
        var eased = 1 - Math.pow(1 - k, 2.2);
        return { x: 560 - 260 * eased, face: 1, gait: 1 - k * 0.6, phase: "approach" };
      }
      if (t < 3.0) return { x: 300, face: 1, gait: 0, phase: "alert" };
      if (t < 4.2) {
        var r = (t - 3.0) / 1.2;
        return { x: 300 + 290 * r * r, face: -1, gait: 2.2, phase: "flee" };
      }
      return { x: 620, face: -1, gait: 0, phase: "clear" };
    }

    function confidence(x) {
      if (x > 468) return 0;
      return 0.4 + 0.54 * ME.clamp((468 - x) / 168, 0, 1);
    }

    function render(t, dt) {
      var p = pose(t);
      body.setAttribute("transform", "translate(" + p.x.toFixed(1) + " 236) scale(" + p.face + " 1)");

      var swing = p.gait ? Math.sin(t * 16 * Math.min(p.gait, 1.6)) * 26 : 0;
      legsA.forEach(function (leg) {
        var x = leg.getAttribute("x1");
        leg.setAttribute("transform", "rotate(" + swing.toFixed(1) + " " + x + " -28)");
      });
      legsB.forEach(function (leg) {
        var x = leg.getAttribute("x1");
        leg.setAttribute("transform", "rotate(" + (-swing).toFixed(1) + " " + x + " -28)");
      });

      var c = confidence(p.x);
      if (p.phase === "alert") c = 0.94;
      if (c > 0) {
        var left = p.face === 1 ? p.x - 66 : p.x - 42;
        var right = p.face === 1 ? p.x + 42 : p.x + 66;
        var top = 144, bottom = 240, l = 12;
        box.setAttribute("d",
          "M" + left + " " + (top + l) + "V" + top + "H" + (left + l) +
          "M" + (right - l) + " " + top + "H" + right + "V" + (top + l) +
          "M" + right + " " + (bottom - l) + "V" + bottom + "H" + (right - l) +
          "M" + (left + l) + " " + bottom + "H" + left + "V" + (bottom - l));
        var label = "dog " + c.toFixed(2);
        tagText.textContent = label;
        tagBg.setAttribute("x", left);
        tagBg.setAttribute("y", top - 17);
        tagBg.setAttribute("width", 8 + label.length * 6.4);
        tagText.setAttribute("x", left + 5);
        tagText.setAttribute("y", top - 5);
        det.style.opacity = String(ME.clamp((468 - p.x) / 30, 0, 1));
        stat.textContent = "1 detection · " + (p.phase === "alert" ? "deterrent on" : "tracking");
      } else {
        det.style.opacity = "0";
        stat.textContent = "no detections";
      }

      var alerting = t >= 2.45 && t < 3.6;
      svg.classList.toggle("is-alert", alerting);
      if (t >= 2.45 && !fired) {
        fired = true;
        if (soundOn) chirp();
      }
    }

    var stop = null;
    if (ME.reducedMotion()) render(2.7, 0);
    else {
      render(0, 0);
      stop = whileVisible(stage, opts.interactive, function (dt) {
        clock += dt;
        if (clock >= LOOP) { clock -= LOOP; fired = false; }
        render(clock, dt);
      });
    }

    return { destroy: function () { if (stop) stop(); wrap.remove(); } };
  }

  /* ======================================================================
     BALL — physics ball with a lagging tracker box; fast motion lowers confidence
     ====================================================================== */
  function ball(stage, opts) {
    var canvas = document.createElement("canvas");
    canvas.className = "ball-canvas" + (opts.interactive ? " is-interactive" : "");
    stage.appendChild(canvas);
    var tip = null;
    if (opts.interactive) {
      tip = document.createElement("p");
      tip.className = "stage-tip";
      tip.textContent = "Drag and throw the ball";
      stage.appendChild(tip);
    }
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, DPR = 1, floor = 0;
    var b = { x: 0, y: 0, vx: 0, vy: 0, r: 20 };
    var history = [];
    var trail = [];
    var track = { x: 0, y: 0, conf: 0.97 };
    var rest = 0;
    var drag = null;
    var frameNo = 0;

    function size() {
      // layout size, not getBoundingClientRect: the dialog page may be mid 3D-flip
      if (!stage.clientWidth || !stage.clientHeight) return;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = stage.clientWidth;
      H = stage.clientHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      b.r = Math.max(12, Math.min(W, H) * 0.065);
      floor = H - 22;
      if (!b.x) { b.x = W * 0.3; b.y = H * 0.35; b.vx = W * 0.9; b.vy = -H * 0.6; track.x = b.x; track.y = b.y; }
      b.x = ME.clamp(b.x, b.r, W - b.r);
      b.y = Math.min(b.y, floor - b.r);
    }

    function kick() {
      b.vx = (Math.random() < 0.5 ? -1 : 1) * ME.rand(W * 0.7, W * 1.3);
      b.vy = -ME.rand(H * 2.3, H * 3.1);
    }

    function step(dt) {
      var g = H * 3.4;
      if (drag) {
        b.x = ME.lerp(b.x, drag.x, 0.5);
        b.y = ME.lerp(b.y, drag.y, 0.5);
        b.vx = 0; b.vy = 0;
      } else {
        b.vy += g * dt;
        b.vx *= Math.pow(0.55, dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > floor - b.r) {
          b.y = floor - b.r;
          if (Math.abs(b.vy) > 60) b.vy = -b.vy * 0.78; else b.vy = 0;
          b.vx *= 0.985;
        }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.6; }
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.85; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.85; }
        var speed = Math.hypot(b.vx, b.vy);
        if (speed < 40 && b.y >= floor - b.r - 1) rest += dt; else rest = 0;
        if (rest > (opts.interactive ? 2.6 : 1.1)) { rest = 0; kick(); }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // floor + shadow
      ctx.strokeStyle = "rgba(" + PAPER + ", .14)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, floor + 0.5); ctx.lineTo(W, floor + 0.5); ctx.stroke();
      var height = ME.clamp((floor - b.r - b.y) / H, 0, 1);
      ctx.fillStyle = "rgba(0, 0, 0, " + (0.45 - height * 0.35).toFixed(3) + ")";
      ctx.beginPath();
      ctx.ellipse(b.x, floor + 2, b.r * (1.1 - height * 0.5), b.r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // trail of tracked centres
      for (var i = 0; i < trail.length; i++) {
        var a = (i + 1) / trail.length;
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = AMBER;
        ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, 1.5 + a * 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ball
      var grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
      grad.addColorStop(0, AMBER_HI);
      grad.addColorStop(0.55, AMBER);
      grad.addColorStop(1, AMBER_LO);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(20, 33, 61, .35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.9, b.y, b.r * 1.1, -0.9, 0.9); ctx.stroke();

      // tracker box (lags a few frames, like real inference)
      var s = b.r * 2 + 18, l = 10;
      var x0 = track.x - s / 2, y0 = track.y - s / 2;
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + l); ctx.lineTo(x0, y0); ctx.lineTo(x0 + l, y0);
      ctx.moveTo(x0 + s - l, y0); ctx.lineTo(x0 + s, y0); ctx.lineTo(x0 + s, y0 + l);
      ctx.moveTo(x0 + s, y0 + s - l); ctx.lineTo(x0 + s, y0 + s); ctx.lineTo(x0 + s - l, y0 + s);
      ctx.moveTo(x0 + l, y0 + s); ctx.lineTo(x0, y0 + s); ctx.lineTo(x0, y0 + s - l);
      ctx.stroke();

      ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
      var label = "ball " + track.conf.toFixed(2);
      var tw = ctx.measureText(label).width + 10;
      var ty = y0 - 17 < 4 ? y0 + s + 1 : y0 - 17;
      ctx.fillStyle = AMBER;
      ctx.fillRect(x0, ty, tw, 16);
      ctx.fillStyle = NAVY;
      ctx.fillText(label, x0 + 5, ty + 12);

      // HUD
      var speed = Math.hypot(b.vx, b.vy);
      ctx.fillStyle = "rgba(" + PAPER + ", .55)";
      ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText("TRACK #1 · YOLO", 14, 21);
      var v = "V " + Math.round(speed) + " PX/S";
      ctx.fillText(v, W - 14 - ctx.measureText(v).width, 21);
    }

    function tick(dt) {
      if (!W) size();
      var sub = 2, h = Math.min(dt, 1 / 30) / sub;
      for (var k = 0; k < sub; k++) step(h);

      history.push({ x: b.x, y: b.y });
      if (history.length > 4) history.shift();
      var seen = history[0];
      track.x = ME.lerp(track.x, seen.x, 0.55);
      track.y = ME.lerp(track.y, seen.y, 0.55);
      var speed = Math.hypot(b.vx, b.vy);
      var target = ME.clamp(0.98 - speed / 3200, 0.55, 0.98);
      track.conf = ME.clamp(ME.lerp(track.conf, target, 0.12) + (Math.random() - 0.5) * 0.006, 0.5, 0.99);

      frameNo++;
      if (frameNo % 2 === 0) {
        trail.push({ x: track.x, y: track.y });
        if (trail.length > 22) trail.shift();
      }
      draw();
    }

    /* drag & throw (dialog only) */
    function local(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / (r.width || W)), y: (e.clientY - r.top) * (H / (r.height || H)) };
    }
    if (opts.interactive) {
      canvas.addEventListener("pointerdown", function (e) {
        var p = local(e);
        if (Math.hypot(p.x - b.x, p.y - b.y) > b.r * 2.2) {
          // tap elsewhere: kick the ball away from the tap
          var dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
          b.vx += (dx / d) * W * 1.4;
          b.vy += (dy / d) * H * 2 - H * 1.2;
          return;
        }
        drag = { x: p.x, y: p.y, samples: [{ t: performance.now(), x: p.x, y: p.y }] };
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add("is-dragging");
        if (tip) tip.hidden = true;
      });
      canvas.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var p = local(e);
        drag.x = ME.clamp(p.x, b.r, W - b.r);
        drag.y = ME.clamp(p.y, b.r, floor - b.r);
        var now = performance.now();
        drag.samples.push({ t: now, x: drag.x, y: drag.y });
        while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
      });
      var release = function () {
        if (!drag) return;
        var s0 = drag.samples[0], s1 = drag.samples[drag.samples.length - 1];
        var dt = Math.max((s1.t - s0.t) / 1000, 0.016);
        b.vx = ME.clamp((s1.x - s0.x) / dt, -3600, 3600);
        b.vy = ME.clamp((s1.y - s0.y) / dt, -3600, 3600);
        drag = null;
        rest = 0;
        canvas.classList.remove("is-dragging");
      };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
    }

    var ro = "ResizeObserver" in window ? new ResizeObserver(function () { size(); if (ME.reducedMotion()) draw(); }) : null;
    if (ro) ro.observe(stage);
    size();

    var stop = null;
    if (ME.reducedMotion()) {
      b.x = W * 0.55; b.y = floor - b.r; track.x = b.x; track.y = b.y;
      draw();
    } else {
      stop = whileVisible(stage, opts.interactive, tick);
    }

    return {
      destroy: function () {
        if (stop) stop();
        if (ro) ro.disconnect();
        canvas.remove();
        if (tip) tip.remove();
      }
    };
  }

  /* ======================================================================
     SCHEMA — the prison database ER model; relations light up per table
     ====================================================================== */
  var TABLES = [
    { id: "inmates", x: 30, y: 36, cols: [["id", "PK"], ["name", ""], ["cell_id", "FK"], ["admitted_on", ""]] },
    { id: "cells", x: 282, y: 16, cols: [["id", "PK"], ["block", ""], ["capacity", ""]] },
    { id: "staff", x: 30, y: 176, cols: [["id", "PK"], ["name", ""], ["role", ""]] },
    { id: "visits", x: 282, y: 148, cols: [["id", "PK"], ["inmate_id", "FK"], ["staff_id", "FK"], ["visited_at", ""]] }
  ];
  var RELS = [
    { from: ["inmates", 2], to: ["cells", 0], via: 244 },
    { from: ["visits", 1], to: ["inmates", 0], via: 258 },
    { from: ["visits", 2], to: ["staff", 0], via: 230 }
  ];
  var QUERIES = {
    inmates: "SELECT i.name, c.block FROM inmates i JOIN cells c ON c.id = i.cell_id;",
    cells: "SELECT c.block, COUNT(i.id) FROM cells c LEFT JOIN inmates i ON i.cell_id = c.id GROUP BY c.block;",
    staff: "SELECT s.name, COUNT(v.id) FROM staff s LEFT JOIN visits v ON v.staff_id = s.id GROUP BY s.id;",
    visits: "SELECT v.visited_at, i.name FROM visits v JOIN inmates i ON i.id = v.inmate_id;"
  };
  var TW = 168, HEAD = 24, ROW = 19;

  function tableById(id) { return TABLES.filter(function (t) { return t.id === id; })[0]; }
  function rowY(t, i) { return t.y + HEAD + ROW * i + ROW / 2; }

  function schema(stage, opts) {
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 480 300");
    svg.setAttribute("class", "schema" + (opts.interactive ? " is-interactive" : ""));
    svg.setAttribute("aria-hidden", opts.interactive ? "false" : "true");
    if (opts.interactive) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Entity-relationship diagram: inmates reference cells, visits reference inmates and staff");
    }

    var html = "";
    RELS.forEach(function (r, i) {
      var a = tableById(r.from[0]), b = tableById(r.to[0]);
      var ya = rowY(a, r.from[1]), yb = rowY(b, r.to[1]);
      var aRight = a.x < r.via, xa = aRight ? a.x + TW : a.x;
      var bRight = b.x < r.via, xb = bRight ? b.x + TW : b.x;
      var dirA = aRight ? 1 : -1, dirB = bRight ? 1 : -1;
      html += '<g class="rel" data-a="' + r.from[0] + '" data-b="' + r.to[0] + '">' +
        '<path class="rel-line" d="M' + xa + " " + ya + "H" + r.via + "V" + yb + "H" + xb + '"/>' +
        // crow's foot (many) at the foreign-key end, bar (one) at the primary-key end
        '<path class="rel-end" d="M' + (xa + dirA * 9) + " " + ya + "L" + xa + " " + (ya - 5) + "M" + (xa + dirA * 9) + " " + ya + "L" + xa + " " + ya + "M" + (xa + dirA * 9) + " " + ya + "L" + xa + " " + (ya + 5) +
          "M" + (xb + dirB * 6) + " " + (yb - 5) + "V" + (yb + 5) + '"/>' +
        "</g>";
    });
    TABLES.forEach(function (t) {
      var h = HEAD + ROW * t.cols.length + 6;
      html += '<g class="tbl" data-t="' + t.id + '"' + (opts.interactive ? ' tabindex="0" role="button" aria-label="Highlight ' + t.id + ' relations"' : "") + ">" +
        '<rect class="tbl-box" x="' + t.x + '" y="' + t.y + '" width="' + TW + '" height="' + h + '" rx="3"/>' +
        '<rect class="tbl-head" x="' + t.x + '" y="' + t.y + '" width="' + TW + '" height="' + HEAD + '" rx="3"/>' +
        '<text class="tbl-name" x="' + (t.x + 10) + '" y="' + (t.y + 16) + '">' + t.id.toUpperCase() + "</text>";
      t.cols.forEach(function (c, i) {
        var y = rowY(t, i) + 4;
        html += '<text class="tbl-col" x="' + (t.x + 10) + '" y="' + y + '">' + c[0] + "</text>";
        if (c[1]) html += '<text class="tbl-key" x="' + (t.x + TW - 10) + '" y="' + y + '" text-anchor="end">' + c[1] + "</text>";
      });
      html += "</g>";
    });
    svg.innerHTML = html;

    var hudTop = document.createElement("p");
    hudTop.className = "stage-hud";
    hudTop.textContent = "prison_db · 4 tables · 3 relations";
    var query = document.createElement("p");
    query.className = "schema-query";
    stage.appendChild(svg);
    stage.appendChild(hudTop);
    stage.appendChild(query);

    var order = ["inmates", "visits", "staff", "cells"];
    var idx = 0, hovering = false, timer = 0;

    function highlight(id) {
      svg.querySelectorAll(".tbl").forEach(function (g) {
        var tid = g.getAttribute("data-t");
        var related = RELS.some(function (r) {
          return (r.from[0] === id && r.to[0] === tid) || (r.to[0] === id && r.from[0] === tid);
        });
        g.classList.toggle("is-on", tid === id);
        g.classList.toggle("is-related", related);
      });
      svg.querySelectorAll(".rel").forEach(function (g) {
        g.classList.toggle("is-on", g.getAttribute("data-a") === id || g.getAttribute("data-b") === id);
      });
      query.textContent = QUERIES[id];
    }

    function cycle() {
      if (!hovering) {
        highlight(order[idx % order.length]);
        idx++;
      }
      timer = setTimeout(cycle, 2400);
    }

    if (opts.interactive) {
      svg.querySelectorAll(".tbl").forEach(function (g) {
        var on = function () { hovering = true; highlight(g.getAttribute("data-t")); };
        var off = function () { hovering = false; };
        g.addEventListener("pointerenter", on);
        g.addEventListener("pointerleave", off);
        g.addEventListener("focus", on);
        g.addEventListener("blur", off);
        g.addEventListener("click", on);
      });
    }

    highlight(order[0]);
    idx = 1;
    if (!ME.reducedMotion()) timer = setTimeout(cycle, 2400);

    return {
      destroy: function () {
        clearTimeout(timer);
        svg.remove(); hudTop.remove(); query.remove();
      }
    };
  }

  var KINDS = { aqi: aqi, dog: dog, ball: ball, schema: schema };

  ME.demos = {
    mount: function (kind, stage, opts) {
      var fn = KINDS[kind];
      if (!fn || !stage) return { destroy: function () {} };
      try {
        return fn(stage, opts || {});
      } catch (e) {
        console.error("[demos:" + kind + "]", e);
        return { destroy: function () {} };
      }
    }
  };
})();
