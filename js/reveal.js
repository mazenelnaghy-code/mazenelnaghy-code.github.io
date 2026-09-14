/* reveal.js — sections come alive: blocks rise into frame as you scroll, each section title
   decodes like a detector resolving its label, and the hero numbers count up. Everything is
   already in the HTML; with reduced motion (or no JavaScript) it simply stays put. */
(function () {
  "use strict";

  var ME = window.ME;
  var root = document.documentElement;
  var BLOCKS = [
    ".sec-idx", ".sec-note", ".sec-head-sticky .btn", ".pull", ".prose p", ".kicker", ".tile",
    ".proj", ".rail-group", ".rail-item", ".threshold", ".sk-group", ".note",
    ".contact-lead", ".contact-status", ".direct li", ".signal-card",
    ".footer-brand", ".footer-data", ".footer-actions", ".footer-legal"
  ].join(",");
  var GLYPHS = "ABCDEFGHJKLMNOPQRSTUVXYZ0123456789";

  /* ---------- blocks rise in ---------- */
  function blocks() {
    if (!("IntersectionObserver" in window)) return;
    var pending = ME.$$(BLOCKS);
    pending.forEach(function (el) { el.classList.add("rv"); });

    function done(el) {
      el.classList.remove("rv", "in");
      el.style.removeProperty("--rv-delay");
    }

    function show(el, delay) {
      io.unobserve(el);
      var i = pending.indexOf(el);
      if (i > -1) pending.splice(i, 1);
      el.style.setProperty("--rv-delay", delay + "ms");
      el.classList.add("in");
      el.addEventListener("animationend", function end(e) {
        if (e.target !== el || e.animationName !== "rv-in") return;
        el.removeEventListener("animationend", end);
        done(el);
      });
    }

    var io = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (en) { return en.isIntersecting; }).map(function (en) {
        return { el: en.target, r: en.boundingClientRect };
      });
      batch.sort(function (a, b) { return (a.r.top - b.r.top) || (a.r.left - b.r.left); });
      batch.forEach(function (item, i) { show(item.el, Math.min(i * 70, 420)); });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    pending.forEach(function (el) { io.observe(el); });

    // never leave anything hidden: at the very bottom of the page, or when YOLO mode scans it
    function flushAll() {
      pending.slice().forEach(function (el) { io.unobserve(el); done(el); });
      pending = [];
    }
    window.addEventListener("scroll", function () {
      if (pending.length && window.innerHeight + window.scrollY >= root.scrollHeight - 4) flushAll();
    }, { passive: true });
    ME.bus.on("yolo", function (d) { if (d.on) flushAll(); });
  }

  /* ---------- section titles decode when they lock on ---------- */
  function decode(el) {
    var node = el.firstChild;
    if (!node || node.nodeType !== 3 || el.getAttribute("data-decoded")) return;
    el.setAttribute("data-decoded", "1");
    var text = node.nodeValue;
    var r = el.getBoundingClientRect();
    el.style.width = r.width + "px";     // random glyphs have other widths: hold the box still
    el.style.height = r.height + "px";
    el.setAttribute("aria-label", text.trim());
    var chars = text.split("").map(function (ch, i) {
      return { ch: ch, at: (i / text.length) * 0.62 + Math.random() * 0.22 };
    });
    var t0 = performance.now(), dur = 760, last = 0;
    (function step(now) {
      var k = (now - t0) / dur;
      if (k >= 1) {
        node.nodeValue = text;
        el.style.width = "";
        el.style.height = "";
        el.removeAttribute("aria-label");
        return;
      }
      if (now - last > 45) { // swap glyphs ~22 times a second, not every frame
        last = now;
        node.nodeValue = chars.map(function (c) {
          return c.ch === " " || k >= c.at ? c.ch : GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        }).join("");
      }
      requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- hero numbers count up (the rank counts down to #1) ---------- */
  function counters() {
    var hero = document.getElementById("top");
    var specs = ME.$$(".stats dd").map(function (dd) {
      var node = dd.firstChild;
      if (!node || node.nodeType !== 3) return null;
      var raw = node.nodeValue.trim();
      var m = raw.match(/^(#?)(\d+(?:\.\d+)?)$/);
      if (!m) return null;
      // screen readers get the real value; the animated copy is decoration
      var real = document.createElement("span");
      real.className = "sr-only";
      real.textContent = raw;
      var shown = document.createElement("span");
      shown.setAttribute("aria-hidden", "true");
      dd.replaceChild(shown, node);
      dd.insertBefore(real, shown);
      var spec = {
        el: shown,
        raw: raw,
        prefix: m[1],
        to: parseFloat(m[2]),
        from: m[1] ? 24 : 0,
        decimals: (m[2].split(".")[1] || "").length
      };
      shown.textContent = format(spec, spec.from);
      return spec;
    }).filter(Boolean);
    if (!specs.length) return;

    function format(s, v) {
      return s.prefix + (s.decimals ? v.toFixed(s.decimals) : String(Math.round(v)));
    }

    var started = false;
    function run() {
      if (started) return;
      started = true;
      var t0 = performance.now(), dur = 1500, gap = 110;
      (function step(now) {
        var finished = true;
        specs.forEach(function (s, i) {
          var k = ME.clamp((now - t0 - i * gap) / dur, 0, 1);
          if (k < 1) finished = false;
          var e = 1 - Math.pow(1 - k, 3);
          s.el.textContent = k >= 1 ? s.raw : format(s, s.from + (s.to - s.from) * e);
        });
        if (!finished) requestAnimationFrame(step);
      })(t0);
    }

    function whenVisible() {
      var stop = ME.onVisible(hero.querySelector(".stats"), function (v) {
        if (!v) return;
        setTimeout(run, 250);
        if (stop) stop();
      }, { threshold: 0.4 });
    }
    if (root.classList.contains("boot-pending") && ME.boot) ME.bus.on("boot:done", whenVisible);
    else whenVisible();
  }

  function init() {
    if (ME.reducedMotion()) return;
    blocks();
    counters();
    ME.bus.on("lock", function (d) { if (d && d.el) decode(d.el); });
  }

  ME.reveal = { init: init };
})();
