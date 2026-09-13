/* yolo.js — type "yolo" anywhere (or click the footer hint) and the page runs detection on
   itself: every visible element gets a labelled box with a stable confidence. Esc exits. */
(function () {
  "use strict";

  var ME = window.ME;
  var MAX_BOXES = 110;
  var CANDIDATES = [
    "h1", "h2", "h3", "h4", "p", "a", "button", "input", "textarea",
    ".panel", ".stage", ".proj", ".tile", ".stat", ".sk", ".note", ".rail-item",
    ".airchip", ".threshold", ".chips li", ".brand-mark", ".footer-mark"
  ].join(",");
  var LABELS = [
    [".panel", "person"],
    [".brand-mark, .footer-mark", "logo"],
    ["h1", "name"],
    ["h2, h3, h4", "heading"],
    [".airchip", "sensor"],
    ["button", "button"],
    ["a", "link"],
    ["input, textarea", "text_field"],
    [".proj", "project"],
    [".stage", "screen"],
    [".tile", "card"],
    [".sk", "skill"],
    [".stat", "metric"],
    [".note", "note"],
    [".rail-item", "event"],
    [".threshold", "slider"],
    [".chips li", "tag"],
    ["p", "paragraph"]
  ];

  var layer, toast;
  var on = false;
  var boxes = [];        // { el, node }
  var typed = "";
  var lastKeyAt = 0;
  var queued = false;
  var rescanTimer = 0;

  function labelFor(el) {
    for (var i = 0; i < LABELS.length; i++) if (el.matches(LABELS[i][0])) return LABELS[i][1];
    return "object";
  }

  function confidenceFor(el, label) {
    if (label === "person" || label === "name") return 0.99;
    var seed = label + "|" + (el.id || "") + "|" + (el.textContent || "").slice(0, 40);
    return 0.72 + ME.hash01(seed) * 0.27;
  }

  function usable(el, vw, vh) {
    if (el.closest("#yolo, #toast, #boot, dialog, .menu")) return false;
    // skip decoration inside aria-hidden containers (stage HUDs, icon library), keep the containers themselves
    if (el.parentElement && el.parentElement.closest("[aria-hidden='true'], [hidden]")) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 14 || r.height < 10) return false;
    if (r.bottom < -40 || r.top > vh + 40 || r.right < 0 || r.left > vw) return false;
    if (r.width > vw * 0.96 && r.height > vh * 0.8) return false; // page-sized wrappers
    var cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.05;
  }

  function place(box) {
    var r = box.el.getBoundingClientRect();
    box.node.style.transform = "translate(" + Math.round(r.left) + "px," + Math.round(r.top) + "px)";
    box.node.style.width = Math.round(r.width) + "px";
    box.node.style.height = Math.round(r.height) + "px";
    box.node.classList.toggle("is-top", r.top < 18);
  }

  function scan() {
    var t0 = performance.now();
    var vw = window.innerWidth, vh = window.innerHeight;
    var seen = boxes.map(function (b) { return b.el; });
    var found = ME.$$(CANDIDATES).filter(function (el) { return usable(el, vw, vh); });

    // drop boxes whose element scrolled far away
    boxes = boxes.filter(function (b) {
      var keep = found.indexOf(b.el) > -1;
      if (!keep) b.node.remove();
      return keep;
    });

    var added = 0;
    found.forEach(function (el) {
      if (boxes.length >= MAX_BOXES || seen.indexOf(el) > -1) return;
      var label = labelFor(el);
      var node = document.createElement("div");
      node.className = "ybox" + (el.closest(".sec-contact") && !el.closest(".signal-card") ? " on-amber" : "");
      var tag = document.createElement("b");
      tag.textContent = label + " " + confidenceFor(el, label).toFixed(2);
      node.appendChild(tag);
      layer.appendChild(node);
      var box = { el: el, node: node };
      boxes.push(box);
      place(box);
      var delay = ME.reducedMotion() ? 0 : Math.min(added * 16, 900);
      setTimeout(function () { node.classList.add("is-on"); }, delay);
      added++;
    });

    var ms = performance.now() - t0;
    toast.innerHTML = "";
    var text = document.createElement("span");
    text.textContent = "YOLO mode · " + boxes.length + " objects · inference " + ms.toFixed(1) + " ms";
    var exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exit (Esc)";
    exit.addEventListener("click", function () { toggle(false); });
    toast.appendChild(text);
    toast.appendChild(exit);
  }

  function onMove() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      boxes.forEach(place);
    });
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(scan, 180); // pick up elements that scrolled into frame
  }

  function toggle(force) {
    var next = typeof force === "boolean" ? force : !on;
    if (next === on) return;
    if (next && (document.documentElement.classList.contains("boot-pending") || document.documentElement.classList.contains("is-dialog-open"))) return;
    on = next;
    if (on) {
      layer.hidden = false;
      toast.hidden = false;
      scan();
      requestAnimationFrame(function () { toast.classList.add("is-on"); });
      window.addEventListener("scroll", onMove, { passive: true });
      window.addEventListener("resize", onMove);
    } else {
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      clearTimeout(rescanTimer);
      boxes.forEach(function (b) { b.node.classList.remove("is-on"); });
      toast.classList.remove("is-on");
      setTimeout(function () {
        if (on) return;
        boxes.forEach(function (b) { b.node.remove(); });
        boxes = [];
        layer.hidden = true;
        toast.hidden = true;
      }, 260);
    }
    ME.bus.emit("yolo", { on: on });
  }

  function init() {
    layer = document.getElementById("yolo");
    toast = document.getElementById("toast");
    if (!layer || !toast) return;

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && on) { toggle(false); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      var now = performance.now();
      if (now - lastKeyAt > 1500) typed = "";
      lastKeyAt = now;
      typed = (typed + e.key.toLowerCase()).slice(-4);
      if (typed === "yolo") {
        typed = "";
        toggle();
      }
    });

    var hint = document.getElementById("yolo-hint");
    if (hint) hint.addEventListener("click", function () { toggle(); });
  }

  ME.yolo = {
    init: init,
    toggle: toggle,
    isOn: function () { return on; },
    count: function () { return boxes.length; }
  };
})();
