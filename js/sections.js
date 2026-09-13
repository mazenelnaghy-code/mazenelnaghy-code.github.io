/* sections.js — resume rail that fills as you scroll, skills filtered by a confidence
   threshold (like YOLO's conf=), and field notes that open and close. */
(function () {
  "use strict";

  var ME = window.ME;

  function rail() {
    var railEl = document.getElementById("rail");
    if (!railEl) return;
    var items = ME.$$(".rail-item", railEl);
    var queued = false;

    function update() {
      queued = false;
      var box = railEl.getBoundingClientRect();
      var probe = window.innerHeight * 0.62; // the "playhead" height in the viewport
      railEl.style.setProperty("--p", ME.clamp((probe - box.top) / box.height, 0, 1).toFixed(4));
      items.forEach(function (item) {
        var node = item.querySelector(".rail-node").getBoundingClientRect();
        item.classList.toggle("is-passed", node.top + node.height / 2 < probe);
      });
    }
    function queue() {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  function skills() {
    var list = document.getElementById("skill-list");
    var range = document.getElementById("conf");
    if (!list || !range) return;
    var out = document.getElementById("conf-out");
    var code = document.getElementById("conf-code");
    var count = document.getElementById("conf-count");
    var rows = ME.$$(".sk", list);

    // bars grow the first time the list comes into view
    var stop = ME.onVisible(list, function (visible) {
      if (!visible) return;
      list.classList.add("is-on");
      if (stop) stop();
    }, { threshold: 0.12 });

    function apply() {
      var t = parseFloat(range.value);
      var kept = 0;
      rows.forEach(function (row) {
        var below = parseFloat(row.getAttribute("data-v")) + 1e-9 < t;
        row.classList.toggle("is-below", below);
        if (!below) kept++;
      });
      var label = t.toFixed(2);
      out.textContent = label;
      code.textContent = label;
      count.textContent = String(kept);
      range.style.setProperty("--fill", (((t - 0.5) / 0.5) * 100).toFixed(1) + "%");
      range.setAttribute("aria-valuetext", label + ": " + kept + " of " + rows.length + " skills at or above this confidence");
    }
    range.addEventListener("input", apply);
    apply();
  }

  function notes() {
    ME.$$(".note").forEach(function (note) {
      var btn = note.querySelector(".note-btn");
      btn.addEventListener("click", function () {
        var open = !note.classList.contains("is-open");
        note.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  ME.sections = {
    init: function () {
      rail();
      skills();
      notes();
    }
  };
})();
