/* core.js — shared runtime: DOM helpers, storage, event bus, one frame ticker. */
(function () {
  "use strict";

  var ME = (window.ME = window.ME || {});
  var doc = document;
  var root = doc.documentElement;

  /* ---------- helpers ---------- */
  ME.$ = function (sel, el) { return (el || doc).querySelector(sel); };
  ME.$$ = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  ME.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  ME.lerp = function (a, b, t) { return a + (b - a) * t; };
  ME.rand = function (lo, hi) { return lo + Math.random() * (hi - lo); };

  /* stable pseudo-random number in [0,1) for a string (FNV-1a) */
  ME.hash01 = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
  };

  ME.params = new URLSearchParams(location.search);

  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  ME.reducedMotion = function () {
    return ME.params.has("reduced") || !!(motionQuery && motionQuery.matches);
  };

  ME.finePointer = function () {
    return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  };

  ME.cssVar = function (name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  };

  /* ---------- storage (never throws) ---------- */
  ME.store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }
  };

  /* ---------- event bus ---------- */
  var handlers = {};
  ME.bus = {
    on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    off: function (evt, fn) {
      var list = handlers[evt];
      if (list) handlers[evt] = list.filter(function (h) { return h !== fn; });
    },
    emit: function (evt, detail) {
      (handlers[evt] || []).slice().forEach(function (fn) {
        try { fn(detail); } catch (e) { console.error("[bus:" + evt + "]", e); }
      });
    }
  };

  /* ---------- one requestAnimationFrame loop for everything ---------- */
  var subs = [];
  var rafId = 0;
  var last = 0;
  var fpsTime = 0;
  var fpsFrames = 0;

  var ticker = (ME.ticker = {
    fps: 0,
    frame: 0,
    add: function (fn) {
      subs.push(fn);
      start();
      return function remove() {
        var i = subs.indexOf(fn);
        if (i > -1) subs.splice(i, 1);
      };
    }
  });

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
    last = now;
    ticker.frame++;
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      ticker.fps = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
    }
    var list = subs.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](dt, now); }
      catch (e) {
        console.error("[ticker]", e);
        var k = subs.indexOf(list[i]);
        if (k > -1) subs.splice(k, 1);
      }
    }
  }

  function start() {
    if (!rafId && !doc.hidden) {
      last = 0;
      rafId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) stop(); else start();
  });

  /* ---------- visibility helper ---------- */
  ME.onVisible = function (el, fn, options) {
    if (!("IntersectionObserver" in window)) {
      fn(true, null);
      return function () {};
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { fn(entry.isIntersecting, entry); });
    }, options || { threshold: 0 });
    io.observe(el);
    return function () { io.disconnect(); };
  };
})();
