/* cursor.js — the mouse becomes the detector: an amber dot at the pointer and a small reticle
   that locks onto whatever you point at, with a class label. Elements that already draw their
   own detection box (cards, section titles, the portrait) keep theirs. Mouse only; the native
   cursor comes back for touch, reduced motion, the boot intro and the project dialog. */
(function () {
  "use strict";

  var ME = window.ME;
  var root = document.documentElement;
  var TARGETS = 'a[href], button, [role="button"], [role="switch"], input, textarea, select, .seek-tick';
  var OWN_BOX = ".det, .hero-portrait";
  var DARK_SURFACES = ".footer, .signal-card, .stage, .menu";
  var FREE = 26;
  var PAD = 7;

  var dot, box, tag;
  var px = 0, py = 0;
  var cur = { x: 0, y: 0, w: FREE, h: FREE };
  var mode = "free";      // free | lock | own | text
  var target = null;
  var shown = false;
  var pressed = false;
  var queued = false;

  function labelFor(el) {
    if (el.id === "theme-toggle") return "switch";
    if (el.id === "menu-toggle") return "menu";
    if (el.id === "reboot") return "power";
    if (el.id === "yolo-hint") return "secret";
    if (el.matches(".brand")) return "logo";
    if (el.matches(".airchip")) return "sensor";
    if (el.matches(".nav a, .menu-nav a")) return "nav";
    if (el.matches(".seek-tick")) return "chapter";
    if (el.matches(".note-btn")) return "log";
    if (el.matches(".submit")) return "send";
    if (el.matches('input[type="range"]')) return "slider";
    if (el.matches("input, textarea, select")) return "text_field";
    if (el.hasAttribute("download")) return "cv";
    var href = el.getAttribute("href") || "";
    if (/^mailto:/.test(href)) return "email";
    if (/linkedin\.com/.test(href)) return "linkedin";
    if (/github\.com/.test(href)) return "github";
    if (el.matches(".btn")) return "button";
    return el.tagName === "A" ? "link" : "button";
  }

  function confidenceFor(el, label) {
    return 0.86 + ME.hash01(label + "|" + (el.id || "") + "|" + (el.textContent || "").trim().slice(0, 32)) * 0.13;
  }

  function usable() {
    return !root.classList.contains("boot-pending") && !root.classList.contains("is-dialog-open");
  }

  function show(on) {
    shown = on;
    root.classList.toggle("has-reticle", on);
    dot.classList.toggle("is-on", on);
    box.classList.toggle("is-on", on);
    if (!on) {
      setMode("free", null);
      root.classList.remove("is-cursor-locked");
    }
  }

  function setMode(next, el) {
    if (next === mode && el === target) return;
    mode = next;
    target = el;
    box.classList.toggle("is-lock", mode === "lock" || mode === "text");
    box.classList.toggle("is-own", mode === "own");
    dot.classList.toggle("is-text", mode === "text");
    root.classList.toggle("is-cursor-locked", mode !== "free");
    if (el && (mode === "lock" || mode === "text")) {
      var label = labelFor(el);
      tag.textContent = label + " " + confidenceFor(el, label).toFixed(2);
    }
  }

  function surfaceClass(el) {
    var amber = !!(el && el.closest(".sec-contact") && !el.closest(".signal-card"));
    box.classList.toggle("on-amber", amber);
    box.classList.toggle("on-dark", !amber && !!(el && el.closest(DARK_SURFACES)));
  }

  function resolve(el) {
    if (!el || el.nodeType !== 1) { setMode("free", null); surfaceClass(null); return; }
    surfaceClass(el);
    var hit = el.closest(TARGETS);
    if (hit && hit.matches('input:not([type="range"]), textarea')) { setMode("text", hit); return; }
    var own = el.closest(OWN_BOX);
    if (own) { setMode("own", own); return; }
    if (hit) { setMode("lock", hit); return; }
    setMode("free", null);
  }

  function goal() {
    if ((mode === "lock" || mode === "text") && target && target.isConnected) {
      var r = target.getBoundingClientRect();
      if (r.width || r.height) {
        var pad = pressed ? PAD - 3 : PAD;
        return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
      }
    }
    var s = pressed ? FREE - 8 : FREE;
    return { x: px - s / 2, y: py - s / 2, w: s, h: s };
  }

  function frame(dt) {
    if (!shown) return;
    var g = goal();
    var k = 1 - Math.exp(-dt * (mode === "free" ? 26 : 17));
    cur.x += (g.x - cur.x) * k;
    cur.y += (g.y - cur.y) * k;
    cur.w += (g.w - cur.w) * k;
    cur.h += (g.h - cur.h) * k;
    box.style.transform = "translate3d(" + cur.x.toFixed(1) + "px," + cur.y.toFixed(1) + "px,0)";
    box.style.width = cur.w.toFixed(1) + "px";
    box.style.height = cur.h.toFixed(1) + "px";
    box.classList.toggle("tag-below", cur.y < 24);
  }

  function place(x, y) {
    px = x;
    py = y;
    dot.style.transform = "translate3d(" + x + "px," + y + "px,0)";
  }

  // after a scroll the element under a still pointer changes without a pointermove
  function rescan() {
    if (queued || !shown) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      if (shown) resolve(document.elementFromPoint(px, py));
    });
  }

  function init() {
    if (!ME.finePointer() || ME.reducedMotion()) return;

    dot = document.createElement("div");
    dot.className = "cur-dot";
    dot.setAttribute("aria-hidden", "true");
    box = document.createElement("div");
    box.className = "cur-box";
    box.setAttribute("aria-hidden", "true");
    tag = document.createElement("span");
    tag.className = "cur-tag";
    box.appendChild(tag);
    document.body.appendChild(box);
    document.body.appendChild(dot);

    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || !usable()) {
        if (shown) show(false);
        return;
      }
      place(e.clientX, e.clientY);
      if (!shown) {
        var s = FREE;
        cur = { x: px - s / 2, y: py - s / 2, w: s, h: s };
        show(true);
      }
      resolve(e.target);
    }, { passive: true });

    document.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && shown) pressed = true;
    }, { passive: true });
    document.addEventListener("pointerup", function () { pressed = false; }, { passive: true });

    document.addEventListener("pointerout", function (e) {
      if (!e.relatedTarget && shown) show(false); // left the window
    });
    window.addEventListener("blur", function () { if (shown) show(false); });
    window.addEventListener("scroll", rescan, { passive: true });

    ME.bus.on("dialog", function (d) { if (d.open && shown) show(false); });
    ME.bus.on("boot:done", rescan);

    ME.ticker.add(frame);
  }

  ME.cursor = {
    init: init,
    state: function () { return { shown: shown, mode: mode, label: mode === "lock" || mode === "text" ? tag.textContent : "" }; }
  };
})();
