/* hud.js — viewfinder chrome: theme, top bar, section state + lock-ons, seek bar,
   REC / frame / FPS / Port Said clock, mobile menu, live air chip. */
(function () {
  "use strict";

  var ME = window.ME;
  var root = document.documentElement;
  var SECTIONS = ["about", "projects", "resume", "skills", "writing", "contact"];
  var LABELS = { about: "About", projects: "Projects", resume: "Resume", skills: "Skills", writing: "Writing", contact: "Contact" };

  /* ---------- theme: a day / night switch; the new light sweeps out of its knob ---------- */
  function syncThemeChrome(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F4F4F2" : "#0A1120");
    var sw = document.getElementById("theme-toggle");
    if (sw) sw.setAttribute("aria-checked", String(theme === "light"));
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    ME.store.set("me.theme", theme);
    syncThemeChrome(theme);
    ME.bus.emit("theme", { theme: theme });
  }

  ME.theme = {
    get: function () { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; },
    // origin {x, y}: where the sweep starts; without it (or without View Transitions) the swap is instant
    set: function (theme, origin) {
      theme = theme === "light" ? "light" : "dark";
      var canSweep = origin && typeof document.startViewTransition === "function" && !ME.reducedMotion() && theme !== ME.theme.get();
      if (!canSweep) { applyTheme(theme); return; }
      root.classList.add("is-theme-sweep");
      var vt = document.startViewTransition(function () { applyTheme(theme); });
      vt.ready.then(function () {
        var r = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
        var at = " at " + origin.x + "px " + origin.y + "px)";
        root.animate(
          { clipPath: ["circle(0px" + at, "circle(" + Math.ceil(r) + "px" + at] },
          { duration: 760, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(function () { /* transition skipped: the theme is already applied */ });
      vt.finished.then(done, done);
      function done() { root.classList.remove("is-theme-sweep"); }
    }
  };

  /* ---------- helpers ---------- */
  function pad(n, width) {
    n = String(n);
    while (n.length < width) n = "0" + n;
    return n;
  }

  function scrollToSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: ME.reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function init() {
    var topbar = document.getElementById("topbar");
    var seek = document.getElementById("seek");
    var ticksEl = document.getElementById("seek-ticks");
    var progress = document.querySelector(".progress-line");
    var navLinks = ME.$$("[data-nav]");
    var menuLinks = ME.$$(".menu-nav a");

    syncThemeChrome(ME.theme.get());
    var sw = document.getElementById("theme-toggle");
    sw.addEventListener("click", function () {
      var knob = sw.querySelector(".switch-knob").getBoundingClientRect();
      sw.classList.remove("is-flipping");
      void sw.offsetWidth; // restart the squash
      sw.classList.add("is-flipping");
      ME.theme.set(ME.theme.get() === "dark" ? "light" : "dark", {
        x: Math.round(knob.left + knob.width / 2),
        y: Math.round(knob.top + knob.height / 2)
      });
    });
    sw.addEventListener("animationend", function (e) {
      if (e.animationName === "knob-squash") sw.classList.remove("is-flipping");
    });

    /* ---------- seek bar ticks ---------- */
    var ticks = SECTIONS.map(function (id) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "seek-tick";
      b.tabIndex = -1;
      b.setAttribute("data-target", id);
      b.innerHTML = "<span>" + LABELS[id] + "</span>";
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        scrollToSection(id);
      });
      ticksEl.appendChild(b);
      return b;
    });

    function layoutTicks() {
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      ticks.forEach(function (b) {
        var sec = document.getElementById(b.getAttribute("data-target"));
        var y = sec.getBoundingClientRect().top + window.scrollY;
        b.style.left = (ME.clamp(y / max, 0, 1) * 100).toFixed(3) + "%";
      });
    }

    seek.addEventListener("click", function (e) {
      var r = seek.getBoundingClientRect();
      var ratio = ME.clamp((e.clientX - r.left) / r.width, 0, 1);
      window.scrollTo({ top: ratio * (root.scrollHeight - window.innerHeight), behavior: ME.reducedMotion() ? "auto" : "smooth" });
    });

    /* ---------- scroll-linked state ---------- */
    var queued = false;
    function update() {
      queued = false;
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      var p = ME.clamp(window.scrollY / max, 0, 1).toFixed(4);
      seek.style.setProperty("--p", p);
      progress.style.setProperty("--p", p);
      topbar.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    function queue() {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", function () { layoutTicks(); queue(); });
    if ("ResizeObserver" in window) new ResizeObserver(function () { layoutTicks(); queue(); }).observe(document.body);
    layoutTicks();
    update();

    /* ---------- active section ---------- */
    var current = null;
    function setActive(id) {
      if (id === current) return;
      current = id;
      navLinks.forEach(function (a) {
        var on = a.getAttribute("data-nav") === id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      menuLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + id); });
      ticks.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-target") === id); });
      ME.bus.emit("section", { id: id });
    }
    if ("IntersectionObserver" in window) {
      var sectionIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) setActive(en.target.id === "top" ? null : en.target.id);
        });
      }, { rootMargin: "-45% 0px -54% 0px" });
      ["top"].concat(SECTIONS).forEach(function (id) { sectionIO.observe(document.getElementById(id)); });
    }

    /* ---------- section headers lock on when they come into frame ---------- */
    ME.$$(".sec-title.det").forEach(function (el) {
      var stop = ME.onVisible(el, function (visible) {
        if (!visible) return;
        el.classList.add("is-locked");
        ME.bus.emit("lock", { el: el });
        if (stop) stop();
      }, { threshold: 0.75 });
    });

    /* ---------- REC timer, frame counter, FPS, Port Said clock ---------- */
    var elTime = document.getElementById("hud-time");
    var elFrame = document.getElementById("hud-frame");
    var elFps = document.getElementById("hud-fps");
    var elClock = document.getElementById("hud-clock");
    var clockFmt = null;
    try {
      clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch (e) { /* fallback below */ }
    var started = performance.now();

    if (!ME.reducedMotion()) ME.ticker.add(function () { /* keeps frame + FPS measurement honest */ });

    function hudTick() {
      var s = Math.floor((performance.now() - started) / 1000);
      elTime.textContent = pad(Math.floor(s / 3600), 2) + ":" + pad(Math.floor(s / 60) % 60, 2) + ":" + pad(s % 60, 2);
      elFrame.textContent = "F " + pad(ME.ticker.frame % 1000000, 6);
      elFps.textContent = (ME.ticker.fps ? ME.ticker.fps : "--") + " FPS";
      elClock.textContent = clockFmt ? clockFmt.format(new Date()) : new Date().toISOString().slice(11, 19);
    }
    hudTick();
    setInterval(hudTick, 250);

    /* ---------- mobile menu ---------- */
    var menu = document.getElementById("menu");
    var toggle = document.getElementById("menu-toggle");
    var toggleUse = toggle.querySelector("use");
    var main = document.getElementById("main");
    var footer = document.querySelector(".footer");
    var hideTimer = 0;

    function isOpen() { return toggle.getAttribute("aria-expanded") === "true"; }

    function openMenu() {
      var r = toggle.getBoundingClientRect();
      menu.style.setProperty("--mx", Math.round(r.left + r.width / 2) + "px");
      menu.style.setProperty("--my", Math.round(r.top + r.height / 2) + "px");
      clearTimeout(hideTimer);
      menu.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { menu.classList.add("is-open"); });
      });
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      toggleUse.setAttribute("href", "#i-close");
      root.classList.add("is-menu-open");
      main.inert = true;
      footer.inert = true;
      setTimeout(function () {
        var first = menu.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      }, 60);
    }

    function closeMenu(returnFocus) {
      if (!isOpen()) return;
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      toggleUse.setAttribute("href", "#i-menu");
      root.classList.remove("is-menu-open");
      main.inert = false;
      footer.inert = false;
      hideTimer = setTimeout(function () { menu.hidden = true; }, ME.reducedMotion() ? 0 : 620);
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener("click", function () {
      if (isOpen()) closeMenu(false); else openMenu();
    });
    menuLinks.forEach(function (a) {
      a.addEventListener("click", function () { closeMenu(false); });
    });
    menu.querySelector(".menu-foot .btn").addEventListener("click", function () { closeMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) closeMenu(true);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 960) closeMenu(false);
    });

    /* ---------- live air values ---------- */
    ME.air.ready.then(function (state) {
      var c = state.portSaid;
      if (!c) return;
      ME.$$('[data-air="pm25"]').forEach(function (el) { el.textContent = c.pm25.toFixed(1); });
      ME.$$('[data-air="aqi"]').forEach(function (el) { el.textContent = String(Math.round(c.aqi)); });
      ME.$$('[data-air="category"]').forEach(function (el) { el.textContent = c.category; });
      var chip = document.getElementById("airchip");
      chip.classList.toggle("is-sample", state.source !== "live");
      chip.querySelector(".airchip-live").textContent = state.source === "live" ? "Live" : "Sample";
      chip.title = (state.source === "live" ? "Live" : "Saved sample") +
        " reading for Port Said at " + ME.air.timeLocal(c.observedAt) + " Cairo time — PM2.5 " + c.pm25.toFixed(1) +
        " µg/m³, PM10 " + (c.pm10 === null ? "–" : c.pm10.toFixed(1)) + ", US AQI " + Math.round(c.aqi) + " (" + c.category + "), wind " +
        (c.windKmh === null ? "–" : Math.round(c.windKmh)) + " km/h. The background particles follow these numbers. Opens my dashboard.";
    });
  }

  ME.hud = { init: init, scrollToSection: scrollToSection };
})();
