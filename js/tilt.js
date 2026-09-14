/* tilt.js — "what I do" tiles and project cards lean toward the mouse, with a soft amber glare
   where the pointer is. Mouse only; off for reduced motion. */
(function () {
  "use strict";

  var ME = window.ME;
  var CARDS = [[".tile", 7], [".proj", 3.5]];

  function bind(card, maxDeg) {
    var glare = document.createElement("span");
    glare.className = "glare";
    glare.setAttribute("aria-hidden", "true");
    card.appendChild(glare);
    card.classList.add("tilt");

    var rect = null, nx = 0.5, ny = 0.5, queued = false;

    function write() {
      queued = false;
      if (!card.classList.contains("is-tilting")) return;
      card.style.setProperty("--rx", ((0.5 - ny) * maxDeg).toFixed(2) + "deg");
      card.style.setProperty("--ry", ((nx - 0.5) * maxDeg).toFixed(2) + "deg");
      card.style.setProperty("--gx", (nx * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (ny * 100).toFixed(1) + "%");
    }

    function flatten() {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }

    // measure once on entry (the card is flat then), not every move: a tilted box measures differently
    function measure() { rect = card.getBoundingClientRect(); }

    card.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      measure();
      card.classList.add("is-tilting");
    });
    card.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || !rect) return;
      nx = ME.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      ny = ME.clamp((e.clientY - rect.top) / rect.height, 0, 1);
      if (!queued) { queued = true; requestAnimationFrame(write); }
    });
    card.addEventListener("pointerleave", function () {
      card.classList.remove("is-tilting");
      rect = null;
      flatten();
    });
    window.addEventListener("scroll", function () { if (rect) measure(); }, { passive: true });

    // a click may open the project dialog, which grows out of this card's box: flatten first
    card.addEventListener("pointerdown", function () {
      card.classList.remove("is-tilting");
      card.style.transition = "none";
      flatten();
      void card.offsetWidth;
      card.style.transition = "";
    }, true);
  }

  function init() {
    if (!ME.finePointer() || ME.reducedMotion()) return;
    CARDS.forEach(function (pair) {
      ME.$$(pair[0]).forEach(function (card) { bind(card, pair[1]); });
    });
  }

  ME.tilt = { init: init };
})();
