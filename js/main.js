/* main.js — start every module in order; one failing module never takes the page down. */
(function () {
  "use strict";

  var ME = window.ME;
  var order = ["hud", "field", "hero", "projects", "sections", "contact", "reveal", "tilt", "strip", "cursor", "yolo", "boot"];

  order.forEach(function (name) {
    var mod = ME[name];
    if (!mod || typeof mod.init !== "function") return;
    try {
      mod.init();
    } catch (e) {
      console.error("[" + name + "] failed to start", e);
    }
  });

  var yr = document.getElementById("yr");
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
