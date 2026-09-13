/* projects.js — detection cards open into a dialog that grows out of the card,
   flips between projects (buttons, arrow keys, swipe) and closes back into it.
   Deep links: #/projects/<slug>, with back-button support. */
(function () {
  "use strict";

  var ME = window.ME;
  var root = document.documentElement;
  var HASH = /^#\/projects\/([\w-]+)$/;

  var dialog, frame, page, stageEl, scroller;
  var elIndex, elTotal, elTag, elMeta, elTitle, elDesc, elChips;
  var items = [];
  var current = -1;
  var demo = null;
  var pushed = false;
  var busy = false;
  var queued = 0;
  var originCard = null;

  function readCards() {
    items = ME.$$(".proj[data-slug]").map(function (card) {
      var stage = card.querySelector(".stage");
      return {
        card: card,
        slug: card.getAttribute("data-slug"),
        tag: card.getAttribute("data-tag") || "",
        demo: stage ? stage.getAttribute("data-demo") : "",
        meta: card.querySelector(".proj-meta").innerHTML,
        title: card.querySelector(".proj-title").textContent,
        detail: card.querySelector(".proj-detail").innerHTML,
        chips: card.querySelector(".chips").innerHTML
      };
    });
  }

  function indexOf(slug) {
    for (var i = 0; i < items.length; i++) if (items[i].slug === slug) return i;
    return -1;
  }

  function fill(i) {
    var it = items[i];
    current = i;
    elIndex.textContent = String(i + 1);
    elTotal.textContent = String(items.length);
    elTag.textContent = it.tag;
    elMeta.innerHTML = it.meta;
    elTitle.textContent = it.title;
    elDesc.innerHTML = it.detail;
    elChips.innerHTML = it.chips;
    scroller.scrollTop = 0;
    if (demo) demo.destroy();
    stageEl.innerHTML = "";
    demo = ME.demos.mount(it.demo, stageEl, { interactive: true });
  }

  function setHash(slug, mode) {
    var url = slug ? "#/projects/" + slug : "#projects";
    if (mode === "push") history.pushState({ project: slug }, "", url);
    else history.replaceState(history.state, "", url);
  }

  /* FLIP: start the frame at the card's rectangle, then release it to its natural box */
  function morphFrom(rect, done) {
    if (ME.reducedMotion() || !rect) { if (done) done(); return; }
    var end = frame.getBoundingClientRect();
    frame.style.transition = "none";
    frame.style.transform =
      "translate(" + (rect.left - end.left) + "px," + (rect.top - end.top) + "px) " +
      "scale(" + (rect.width / end.width) + "," + (rect.height / end.height) + ")";
    frame.classList.add("is-morphing");
    frame.getBoundingClientRect(); // commit the start state
    frame.style.transition = "transform .6s var(--ease-out)";
    frame.style.transform = "none";
    setTimeout(function () {
      frame.classList.remove("is-morphing");
      frame.style.transition = "";
      if (done) done();
    }, 600);
  }

  function morphTo(rect, done) {
    if (ME.reducedMotion() || !rect) { done(); return; }
    var start = frame.getBoundingClientRect();
    frame.classList.add("is-morphing");
    frame.style.transition = "transform .45s var(--ease-in-out)";
    frame.style.transform =
      "translate(" + (rect.left - start.left) + "px," + (rect.top - start.top) + "px) " +
      "scale(" + (rect.width / start.width) + "," + (rect.height / start.height) + ")";
    setTimeout(done, 450);
  }

  function open(slug, options) {
    options = options || {};
    var i = indexOf(slug);
    if (i < 0 || busy) return;
    if (dialog.open) { if (i !== current) flipTo(i, i > current ? 1 : -1); return; }

    busy = true;
    originCard = items[i].card;
    fill(i);
    root.classList.add("is-dialog-open");
    ME.bus.emit("dialog", { open: true });
    dialog.showModal();
    requestAnimationFrame(function () { dialog.classList.add("is-open"); });

    if (options.history === "push") { setHash(slug, "push"); pushed = true; }

    var rect = options.fromEl ? options.fromEl.getBoundingClientRect() : null;
    morphFrom(rect, function () { busy = false; });
    document.getElementById("pd-close").focus({ preventScroll: true });
  }

  function finishClose() {
    queued = 0;
    dialog.classList.remove("is-open");
    frame.classList.remove("is-morphing");
    frame.style.transition = "";
    frame.style.transform = "";
    dialog.close();
    if (demo) { demo.destroy(); demo = null; }
    stageEl.innerHTML = "";
    root.classList.remove("is-dialog-open");
    ME.bus.emit("dialog", { open: false });
    var card = items[current] ? items[current].card : originCard;
    var btn = card && card.querySelector(".proj-open");
    if (btn) btn.focus({ preventScroll: true });
    current = -1;
    busy = false;
  }

  function animateClose() {
    if (!dialog.open || busy) return;
    busy = true;
    var card = items[current] && items[current].card;
    var r = card ? card.getBoundingClientRect() : null;
    var onScreen = r && r.bottom > 0 && r.top < window.innerHeight;
    dialog.classList.remove("is-open");
    morphTo(onScreen ? r : null, finishClose);
  }

  /* close requested by the user (button, Esc, backdrop) */
  function requestClose() {
    if (!dialog.open || busy) return;
    if (pushed) {
      pushed = false;
      history.back(); // popstate runs animateClose
    } else {
      setHash(null, "replace");
      animateClose();
    }
  }

  function flipTo(i, dir) {
    if (busy || i === current) return;
    var n = items.length;
    i = (i + n) % n;
    if (ME.reducedMotion()) {
      fill(i);
      setHash(items[i].slug, "replace");
      return;
    }
    busy = true;
    var outCls = dir > 0 ? "is-out-next" : "is-out-prev";
    var inCls = dir > 0 ? "is-in-next" : "is-in-prev";
    page.classList.add(outCls);
    setTimeout(function () {
      page.classList.remove(outCls);
      fill(i);
      setHash(items[i].slug, "replace");
      page.classList.add(inCls);
      setTimeout(function () {
        page.classList.remove(inCls);
        busy = false;
        if (queued && dialog.open) {
          var q = queued;
          queued = 0;
          flip(q);
        }
      }, 420);
    }, 240);
  }

  function flip(dir) {
    if (!dialog.open) return;
    if (busy) { queued = dir; return; } // remember one press made mid-flip
    flipTo(current + dir, dir);
  }

  function fromHash(isInitial) {
    var m = location.hash.match(HASH);
    if (m && indexOf(m[1]) > -1) {
      if (!dialog.open) {
        if (isInitial) {
          // land the page on the project grid instantly, so closing reveals the cards
          var sec = document.getElementById("projects");
          if (sec) {
            root.style.scrollBehavior = "auto";
            sec.scrollIntoView({ block: "start" });
            root.style.scrollBehavior = "";
          }
        }
        open(m[1], { fromEl: null });
      } else if (items[current].slug !== m[1]) {
        var j = indexOf(m[1]);
        flipTo(j, j > current ? 1 : -1);
      }
    } else if (dialog.open) {
      pushed = false;
      animateClose();
    }
  }

  function init() {
    dialog = document.getElementById("proj-dialog");
    if (!dialog || typeof dialog.showModal !== "function") return;
    frame = document.getElementById("pd-frame");
    page = document.getElementById("pd-page");
    stageEl = document.getElementById("pd-stage");
    scroller = dialog.querySelector(".pd-scroll");
    elIndex = document.getElementById("pd-index");
    elTotal = document.getElementById("pd-total");
    elTag = document.getElementById("pd-tag");
    elMeta = document.getElementById("pd-meta");
    elTitle = document.getElementById("pd-title");
    elDesc = document.getElementById("pd-desc");
    elChips = document.getElementById("pd-chips");

    readCards();

    items.forEach(function (it) {
      var stage = it.card.querySelector(".stage");
      ME.demos.mount(it.demo, stage, { interactive: false });
      it.card.querySelector(".proj-open").addEventListener("click", function () {
        open(it.slug, { fromEl: it.card, history: "push" });
      });
    });

    document.getElementById("pd-close").addEventListener("click", requestClose);
    document.getElementById("pd-prev").addEventListener("click", function () { flip(-1); });
    document.getElementById("pd-next").addEventListener("click", function () { flip(1); });

    dialog.addEventListener("cancel", function (e) {
      e.preventDefault(); // Esc: animate instead of snapping shut
      requestClose();
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) requestClose(); // backdrop / padding area
    });
    dialog.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); flip(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); flip(-1); }
    });

    // swipe between projects on touch screens (not on the demo stage, which has its own gestures)
    var sx = 0, sy = 0, tracking = false;
    scroller.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || e.target.closest(".pd-stage")) return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    });
    scroller.addEventListener("pointerup", function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) flip(dx < 0 ? 1 : -1);
    });

    window.addEventListener("popstate", function () { fromHash(false); });
    window.addEventListener("hashchange", function () { fromHash(false); });
    fromHash(true);
  }

  ME.projects = {
    init: init,
    open: function (slug, options) { open(slug, options || {}); },
    close: requestClose
  };
})();
