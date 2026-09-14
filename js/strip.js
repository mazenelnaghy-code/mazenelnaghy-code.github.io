/* strip.js — a band of words drifting across the page. Scrolling pushes it faster, it follows
   the scroll direction and leans a little with the speed. Decorative only (aria-hidden). */
(function () {
  "use strict";

  var ME = window.ME;
  var BASE_SPEED = 38;   // px per second at rest
  var MAX_LEAN = 3;      // degrees of skew at full speed

  function init() {
    var strip = document.querySelector(".strip");
    if (!strip) return;
    var track = strip.querySelector(".strip-track");
    var group = track.querySelector(".strip-group");
    var groupW = 0;

    // repeat the words until the band is always full, however wide the screen
    function fill() {
      ME.$$(".strip-group.is-copy", track).forEach(function (n) { n.remove(); });
      groupW = group.getBoundingClientRect().width;
      if (!groupW) return;
      var copies = Math.ceil(strip.clientWidth / groupW) + 1;
      for (var i = 0; i < copies; i++) {
        var copy = group.cloneNode(true);
        copy.classList.add("is-copy");
        track.appendChild(copy);
      }
    }

    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      fill();
      var resizeTimer = 0;
      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fill, 150);
      });
      if (ME.reducedMotion()) return;

      var offset = 0, dir = 1, speed = 0, lean = 0, lastY = window.scrollY;
      function frame(dt) {
        if (!groupW) return;
        var y = window.scrollY, dy = y - lastY;
        lastY = y;
        if (dy) dir = dy > 0 ? 1 : -1;
        var v = Math.min(Math.abs(dy) / Math.max(dt, 1 / 144), 2400);
        speed += (v - speed) * Math.min(1, dt * 5);
        offset = (offset + dir * (BASE_SPEED + speed * 0.45) * dt) % groupW;
        if (offset < 0) offset += groupW;
        var targetLean = -dir * MAX_LEAN * Math.min(speed / 1400, 1);
        lean += (targetLean - lean) * Math.min(1, dt * 6);
        track.style.transform = "translate3d(" + (-offset).toFixed(1) + "px,0,0) skewX(" + lean.toFixed(2) + "deg)";
      }

      var remove = null;
      ME.onVisible(strip, function (visible) {
        if (visible && !remove) {
          lastY = window.scrollY;
          remove = ME.ticker.add(frame);
        } else if (!visible && remove) {
          remove();
          remove = null;
        }
      });
    });
  }

  ME.strip = { init: init };
})();
