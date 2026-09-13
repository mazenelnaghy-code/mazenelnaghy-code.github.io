/* boot.js — the intro. Plug the USB-C cable into the board (drag it, click it, or press Enter),
   watch the device boot with a live air reading, then the power LED flies into the logo's dot
   and the dot opens up into the page. First visit only; "Reboot device" replays it. */
(function () {
  "use strict";

  var ME = window.ME;
  var root = document.documentElement;
  var SVGNS = "http://www.w3.org/2000/svg";
  var REST = { x: 96, y: 446 };   // plug origin lying below the board
  var TARGET = { x: 18, y: 288 }; // plug origin with its tip seated in the port
  var SNAP_RADIUS = 46;

  var boot, board, plug, cable, guide, term, hint, skipBtn, kicker, clockEl;
  var pos = { x: REST.x, y: REST.y };
  var state = "idle"; // idle | dragging | plugging | booting | done
  var run = 0;
  var reduced = false;
  var hintTimer = 0, clockTimer = 0, wobbleId = 0;
  var returnFocus = null;
  var grab = null;

  var INERT = ["#topbar", "#main", ".footer", "#hudbar", ".skip", "#menu"];

  /* ---------- small helpers ---------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function guard(id) { if (id !== run) throw new Error("boot sequence superseded"); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  // frame-by-frame tween; a throw inside fn (e.g. a superseded sequence) rejects instead of escaping
  function animate(ms, fn, ease) {
    return new Promise(function (resolve, reject) {
      function apply(k) {
        try { fn(k); return true; } catch (err) { reject(err); return false; }
      }
      if (reduced || ms <= 0) { if (apply(1)) resolve(); return; }
      var t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / ms);
        if (!apply((ease || easeInOut)(k))) return;
        if (k < 1) requestAnimationFrame(step); else resolve();
      })(t0);
    });
  }

  function setInert(on) {
    INERT.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.inert = on;
    });
  }

  function setPlug(x, y) {
    pos.x = x;
    pos.y = y;
    plug.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
    var rx = x - 30;
    cable.setAttribute("d", "M-40 500 C 0 480, " + (rx - 80).toFixed(1) + " " + (y + 46).toFixed(1) + ", " + rx.toFixed(1) + " " + y.toFixed(1));
  }

  function svgPoint(e) {
    var m = board.getScreenCTM();
    if (!m) return { x: pos.x, y: pos.y };
    var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function buildPins() {
    var g = document.getElementById("b-gpio");
    if (!g || g.childNodes.length) return;
    for (var col = 0; col < 20; col++) {
      for (var row = 0; row < 2; row++) {
        var r = document.createElementNS(SVGNS, "rect");
        r.setAttribute("class", "b-pin");
        r.setAttribute("x", 128 + col * 14);
        r.setAttribute("y", 124 + row * 14);
        r.setAttribute("width", 8);
        r.setAttribute("height", 8);
        r.setAttribute("rx", 1);
        g.appendChild(r);
      }
    }
  }

  function startClock() {
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { /* ignore */ }
    var tick = function () { clockEl.textContent = fmt ? fmt.format(new Date()) : "--:--"; };
    tick();
    clearInterval(clockTimer);
    clockTimer = setInterval(tick, 10000);
  }

  /* ---------- hint: after a moment, the plug nudges and a dashed path shows the way ---------- */
  function scheduleHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      if (state !== "idle" || boot.hidden) return;
      boot.classList.add("is-hinting");
      if (reduced) return;
      var t0 = performance.now();
      cancelAnimationFrame(wobbleId);
      (function wobble(now) {
        if (state !== "idle" || boot.hidden || !boot.classList.contains("is-hinting")) return;
        var t = (now - t0) / 1000;
        var nudge = Math.max(0, Math.sin(t * 3.2)) * 7;
        setPlug(REST.x - nudge * 0.55, REST.y - nudge);
        wobbleId = requestAnimationFrame(wobble);
      })(t0);
    }, 2400);
  }

  function stopHint() {
    clearTimeout(hintTimer);
    cancelAnimationFrame(wobbleId);
    boot.classList.remove("is-hinting");
  }

  /* ---------- plugging in ---------- */
  function moveTo(target, ms) {
    var from = { x: pos.x, y: pos.y };
    return animate(ms, function (k) {
      setPlug(from.x + (target.x - from.x) * k, from.y + (target.y - from.y) * k);
    });
  }

  function autoPlug() {
    if (state !== "idle") return;
    stopHint();
    state = "plugging";
    var id = run;
    moveTo(TARGET, 480).then(function () {
      if (id === run) powerOn();
    });
  }

  function snapIn() {
    state = "plugging";
    plug.classList.remove("is-dragging");
    grab = null;
    var id = run;
    moveTo(TARGET, 120).then(function () {
      if (id === run) powerOn();
    });
  }

  /* ---------- the boot log ---------- */
  function resetTerminal() {
    term.innerHTML = '<p class="term-line is-prompt">edge-01 login: <span class="term-caret" aria-hidden="true"></span></p>';
  }

  function typeLine(id, text, status, statusClass) {
    var p = document.createElement("p");
    p.className = "term-line";
    var body = document.createElement("span");
    p.appendChild(body);
    term.appendChild(p);
    var chars = 0;
    return animate(Math.min(200, text.length * 5), function (k) {
      guard(id);
      var n = Math.round(text.length * k);
      if (n !== chars) { chars = n; body.textContent = text.slice(0, n); }
    }, function (k) { return k; }).then(function () {
      guard(id);
      body.textContent = text;
      if (status) {
        var st = document.createElement("span");
        st.className = "st " + (statusClass || "st-ok");
        st.textContent = status;
        p.appendChild(st);
      }
      return wait(reduced ? 0 : 60);
    });
  }

  function runTerminal(id) {
    term.innerHTML = "";
    var airInfo = Promise.race([ME.air.ready, wait(900).then(function () { return null; })]);
    return typeLine(id, "[ 0.00] power   5.1 V · 3.0 A", "ok")
      .then(function () { return typeLine(id, "[ 0.21] camera  /dev/video0 · 640×480", "ok"); })
      .then(function () { return typeLine(id, "[ 0.47] model   mazen.pt · yolo · 6.2 MB", "ok"); })
      .then(function () { return airInfo; })
      .then(function (air) {
        guard(id);
        var c = air && air.portSaid;
        var text = "[ 0.93] air     port_said pm2.5 " + (c ? c.pm25.toFixed(1) : "--") + " µg/m³";
        if (!air) return typeLine(id, text, "pending", "st-warn");
        return typeLine(id, text, air.source === "live" ? "live" : "sample", air.source === "live" ? "st-ok" : "st-warn");
      })
      .then(function () { return typeLine(id, "[ 1.18] feed    4 projects · 7 entries · 11 skills", "ok"); })
      .then(function () {
        guard(id);
        var p = document.createElement("p");
        p.className = "term-line is-prompt";
        p.innerHTML = '&gt; inference started<span class="term-caret" aria-hidden="true"></span>';
        term.appendChild(p);
        return wait(reduced ? 150 : 300);
      });
  }

  /* ---------- the LED becomes the logo's dot ---------- */
  function assemble(id) {
    guard(id);
    if (reduced) return Promise.resolve();
    var led = document.getElementById("led-pwr").getBoundingClientRect();
    boot.classList.add("is-assembling");

    var mark = document.getElementById("boot-mark-big");
    var w = mark.offsetWidth, h = mark.offsetHeight;
    var x0 = boot.clientWidth / 2 - w / 2, y0 = boot.clientHeight / 2 - h / 2;
    var size1 = w * 0.162;
    var tx = x0 + w * 0.838, ty = y0 + h * 0.495;
    var size0 = Math.max(led.width, 8);
    var sx = led.left + led.width / 2 - size0 / 2, sy = led.top + led.height / 2 - size0 / 2;

    var fly = document.createElement("span");
    fly.className = "boot-flydot";
    boot.appendChild(fly);

    return wait(120).then(function () {
      return animate(620, function (k) {
        guard(id);
        var s = size0 + (size1 - size0) * k;
        var x = sx + (tx - sx) * k;
        var y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 60; // a small arc
        fly.style.width = fly.style.height = s.toFixed(1) + "px";
        fly.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
    }).then(function () {
      boot.classList.add("is-dot-landed");
      fly.remove();
      return wait(300);
    }, function (err) {
      fly.remove();
      throw err;
    });
  }

  /* ---------- the dot opens into the page ---------- */
  function openIris(id) {
    guard(id);
    if (reduced) return Promise.resolve();
    var dot = boot.querySelector(".bmb-dot").getBoundingClientRect();
    var cx = dot.left + dot.width / 2, cy = dot.top + dot.height / 2;
    var r0 = dot.width / 2;
    var maxR = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 24;
    var ring = document.createElement("span");
    ring.className = "boot-ring";
    document.body.appendChild(ring);
    boot.classList.add("is-opening");

    return animate(850, function (k) {
      guard(id);
      var r = r0 + (maxR - r0) * k;
      var mask = "radial-gradient(circle at " + cx.toFixed(1) + "px " + cy.toFixed(1) + "px, transparent " + r.toFixed(1) + "px, #000 " + (r + 1.5).toFixed(1) + "px)";
      boot.style.webkitMaskImage = mask;
      boot.style.maskImage = mask;
      ring.style.width = ring.style.height = (r * 2).toFixed(1) + "px";
      ring.style.transform = "translate(" + (cx - r).toFixed(1) + "px," + (cy - r).toFixed(1) + "px)";
      ring.style.opacity = String(1 - k);
    }).then(function () { ring.remove(); }, function (err) { ring.remove(); throw err; });
  }

  /* ---------- sequence ---------- */
  function powerOn() {
    state = "booting";
    var id = run;
    boot.classList.add("is-on");
    kicker.lastChild.textContent = " device online";
    hint.textContent = "powered · booting";
    runTerminal(id)
      .then(function () { return assemble(id); })
      .then(function () { return openIris(id); })
      .then(function () { if (id === run) finish(); })
      .catch(function (err) {
        if (!/superseded/.test(err && err.message)) {
          console.error("[boot]", err);
          finish();
        }
      });
  }

  function finish() {
    run++;
    state = "done";
    stopHint();
    clearInterval(clockTimer);
    ME.store.set("me.booted", "1");
    boot.hidden = true;
    boot.classList.remove("is-on", "is-assembling", "is-dot-landed", "is-opening", "is-hinting");
    boot.style.maskImage = "";
    boot.style.webkitMaskImage = "";
    boot.style.opacity = "";
    boot.style.transition = "";
    root.classList.remove("boot-pending");
    setInert(false);
    ME.$$(".boot-flydot, .boot-ring").forEach(function (el) { el.remove(); });
    ME.bus.emit("boot:done", {});
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  function skip() {
    if (boot.hidden) return;
    run++;
    state = "done";
    stopHint();
    if (reduced) { finish(); return; }
    boot.style.transition = "opacity .35s ease";
    boot.style.opacity = "0";
    setTimeout(finish, 360);
  }

  function show(instant) {
    run++;
    state = "idle";
    reduced = !!instant || ME.reducedMotion();
    boot.classList.remove("is-on", "is-assembling", "is-dot-landed", "is-opening", "is-hinting");
    boot.style.maskImage = "";
    boot.style.webkitMaskImage = "";
    boot.style.opacity = "";
    kicker.lastChild.textContent = " device offline";
    hint.innerHTML = ME.finePointer() ? "Drag the cable into the port · or press <kbd>Enter</kbd>" : "Drag the cable into the port · or tap the plug";
    resetTerminal();
    setPlug(REST.x, REST.y);
    boot.hidden = false;
    root.classList.add("boot-pending");
    setInert(true);
    startClock();
    scheduleHint();
    setTimeout(function () { plug.focus({ preventScroll: true }); }, 30);
  }

  /* ---------- wiring ---------- */
  function init() {
    boot = document.getElementById("boot");
    if (!boot) return;
    ME.boot.started = true;
    board = document.getElementById("board");
    plug = document.getElementById("plug");
    cable = document.getElementById("cable");
    guide = document.getElementById("guide");
    term = document.getElementById("boot-term");
    hint = document.getElementById("boot-hint");
    skipBtn = document.getElementById("boot-skip");
    kicker = boot.querySelector(".boot-kicker");
    clockEl = document.getElementById("boot-clock");

    buildPins();
    guide.setAttribute("d", "M" + (REST.x - 34) + " " + (REST.y - 14) + " C 40 420, 0 360, 16 306");
    setPlug(REST.x, REST.y);

    plug.addEventListener("pointerdown", function (e) {
      if (state !== "idle") return;
      e.preventDefault();
      stopHint();
      var p = svgPoint(e);
      grab = { dx: pos.x - p.x, dy: pos.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
      state = "dragging";
      plug.classList.add("is-dragging");
      try { plug.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    });
    plug.addEventListener("pointermove", function (e) {
      if (state !== "dragging" || !grab) return;
      if (Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy) > 5) grab.moved = true;
      var p = svgPoint(e);
      var x = ME.clamp(p.x + grab.dx, -30, 630);
      var y = ME.clamp(p.y + grab.dy, 0, 470);
      setPlug(x, y);
      if (Math.hypot(x - TARGET.x, y - TARGET.y) < SNAP_RADIUS) snapIn();
    });
    var release = function () {
      if (state !== "dragging") return;
      plug.classList.remove("is-dragging");
      var moved = grab && grab.moved;
      grab = null;
      state = "idle";
      if (!moved) { autoPlug(); return; } // a plain click plugs it in
      // dropped short: the cable springs back (unless it gets grabbed again on the way)
      var from = { x: pos.x, y: pos.y };
      animate(420, function (k) {
        if (state === "idle") setPlug(from.x + (REST.x - from.x) * k, from.y + (REST.y - from.y) * k);
      }).then(function () { if (state === "idle") scheduleHint(); });
    };
    plug.addEventListener("pointerup", release);
    plug.addEventListener("pointercancel", release);
    plug.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); autoPlug(); }
    });

    skipBtn.addEventListener("click", skip);
    document.addEventListener("keydown", function (e) {
      if (boot.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); skip(); return; }
      if (e.key === "Enter" && e.target !== skipBtn && state === "idle") { e.preventDefault(); autoPlug(); }
    });

    var reboot = document.getElementById("reboot");
    if (reboot) reboot.addEventListener("click", function () {
      returnFocus = reboot;
      show();
    });

    if (root.classList.contains("boot-pending")) show();
  }

  ME.boot = {
    started: false,
    init: init,
    run: function (options) { show(!!(options && options.instant)); },
    skip: function () { if (boot) skip(); }
  };
})();
