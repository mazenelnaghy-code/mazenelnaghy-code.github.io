/* hero.js — the portrait gets detected: brackets lock on, a scan line reveals true colour,
   confidence flickers like a real detector and the box coordinates follow the pointer. */
(function () {
  "use strict";

  var ME = window.ME;

  function init() {
    var fig = document.getElementById("portrait");
    var subject = document.getElementById("subject");
    var lock = document.getElementById("lock");
    var conf = document.getElementById("lock-conf");
    var coords = document.getElementById("lock-xy");
    if (!fig || !subject || !lock) return;

    var reduced = ME.reducedMotion();
    var hovering = false;
    var introTimer = 0;

    /* ---------- reveal ---------- */
    function reveal(on) {
      fig.classList.add("is-scanning");
      fig.classList.toggle("is-revealed", on);
    }
    function settle() {
      if (!fig.classList.contains("is-revealed")) fig.classList.remove("is-scanning");
    }
    subject.querySelector(".portrait-true").addEventListener("transitionend", settle);

    fig.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      hovering = true;
      clearTimeout(introTimer);
      reveal(true);
    });
    fig.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      hovering = false;
      reveal(false);
    });
    fig.addEventListener("click", function (e) {
      if (e.pointerType === "mouse") return; // mouse users already hover
      reveal(!fig.classList.contains("is-revealed"));
    });

    /* ---------- lock-on sequence ---------- */
    function lockOn() {
      setTimeout(function () { fig.classList.add("is-locked"); }, reduced ? 0 : 350);
      if (reduced) return;
      introTimer = setTimeout(function () {
        reveal(true);
        introTimer = setTimeout(function () { if (!hovering) reveal(false); }, 1900);
      }, 1100);
    }
    if (document.documentElement.classList.contains("boot-pending")) ME.bus.on("boot:done", lockOn);
    else lockOn();

    /* ---------- confidence flicker ---------- */
    if (!reduced) {
      (function flicker() {
        var v = Math.random() < 0.7 ? ME.rand(0.975, 0.995) : ME.rand(0.955, 0.975);
        conf.textContent = v.toFixed(2);
        setTimeout(flicker, ME.rand(650, 1500));
      })();
    }

    /* ---------- bounding box readout ---------- */
    function readout() {
      var s = subject.getBoundingClientRect();
      var l = lock.getBoundingClientRect();
      if (!s.width) return;
      var k = 1000 / s.width;
      coords.textContent =
        "x " + Math.round((l.left - s.left) * k) +
        " · y " + Math.round((l.top - s.top) * k) +
        " · w " + Math.round(l.width * k) +
        " · h " + Math.round(l.height * k);
    }
    lock.addEventListener("transitionend", readout);
    window.addEventListener("resize", readout);
    readout();

    /* ---------- pointer parallax (desktop only) ---------- */
    if (reduced || !ME.finePointer()) return;
    var visible = true;
    ME.onVisible(fig, function (v) { visible = v; });
    var queued = false, nx = 0, ny = 0;
    window.addEventListener("pointermove", function (e) {
      if (!visible || e.pointerType !== "mouse") return;
      nx = e.clientX / window.innerWidth - 0.5;
      ny = e.clientY / window.innerHeight - 0.5;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        subject.style.setProperty("--px", (nx * -14).toFixed(1) + "px");
        subject.style.setProperty("--py", (ny * -10).toFixed(1) + "px");
        lock.style.setProperty("--lx", (nx * 18).toFixed(1) + "px");
        lock.style.setProperty("--ly", (ny * 12).toFixed(1) + "px");
        readout();
      });
    }, { passive: true });
  }

  ME.hero = { init: init };
})();
