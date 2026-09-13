# Live Inference Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note:** executed inline by the author in the same session (user asked to "just build it").
> Code is written directly into the files; this plan fixes the file map, the cross-module contracts and the
> verification for each task. Verification is browser-based (in-app browser against the local dev server).

**Goal:** Build and ship Mazen Elnaghy's interactive "Live Inference" portfolio on GitHub Pages, built around his navy / amber / paper palette.

**Architecture:** Static site, no build step. `index.html` holds all content (readable without JS); CSS split into tokens / base / layout / components; classic `defer` scripts attach to a shared `window.ME` namespace and are initialised by `js/main.js` with per-module error isolation.

**Tech Stack:** HTML5, CSS (custom properties, grid, clip-path, masks), vanilla JS (Canvas 2D, IntersectionObserver, `<dialog>`, Web Audio, Pointer Events), Google Fonts, Web3Forms, GitHub Pages. Local tooling: Node 24 (dev server + asset save endpoint), Git.

**Spec:** `docs/superpowers/specs/2026-09-13-live-inference-portfolio-design.md`

## Global Constraints

- Palette primitives: navy `#14213D`, amber `#FFC42E`, paper `#F4F4F2`; derived tokens exactly as listed in the spec. Amber never used as small text on light grounds; body text contrast ≥ 4.5:1 in both themes.
- Fonts: Barlow Condensed 600/700, IBM Plex Sans 400/500/600, IBM Plex Mono 400/500.
- No frameworks, no build step, no npm dependencies shipped. Only external runtime calls: Google Fonts, the air-quality CSV, Web3Forms.
- All current live-site content is kept; additions limited to GitHub links from the CV (profile, orange-ball-detector, prison-management-system) and the CV's role line.
- Air CSV: `https://mazenelnaghy-code.github.io/egypt-air-quality/data/mart_latest_city.csv`; `observed_at` is UTC; display in `Africa/Cairo`.
- Web3Forms access key `c2713829-04e7-44fa-af32-9b4d3f31929d` (unchanged). Never submit a real message during testing.
- `prefers-reduced-motion: reduce` honored by every animated module.
- Must work at 360 px width and up with no horizontal page scroll.
- Never publish the inspiration screenshots or `profile-original.jpg`. Push to GitHub only after explicit user confirmation.

## File map

| File | Responsibility |
|---|---|
| `index.html` | Content + structure, inline head script (theme, `js`, `boot-pending`), SVG defs (duotone filter), script tags |
| `404.html` | On-brand not-found page (self-contained) |
| `css/tokens.css` | Palette, semantic tokens per theme, type scale, spacing, z-index scale |
| `css/base.css` | Reset, typography, links, buttons, chips, focus, detection brackets (`.det`), reveal utility |
| `css/layout.css` | HUD bars, viewfinder, mobile menu, hero, section frame, about, resume, skills, writing, contact, footer, responsive |
| `css/components.css` | Boot overlay, project cards + dialog + demo stages, skills slider, writing panels, form states, YOLO overlay, toasts |
| `js/core.js` | `ME` namespace + helpers, store, bus, ticker, visibility helper |
| `js/air.js` | Fetch / parse / fallback air data |
| `js/field.js` | Background particle canvas + cursor detections |
| `js/hud.js` | Theme, top bar, nav state, lock-ons, seek bar, REC / frame / FPS / clock, mobile menu, air chip |
| `js/hero.js` | Portrait lock-on (confidence jitter, bbox coords, parallax, reveal) |
| `js/demos.js` | `aqi`, `dog`, `ball`, `schema` demos |
| `js/projects.js` | Dialog open / flip / close, FLIP animation, hash routing |
| `js/sections.js` | Resume rail, skills bars + threshold, writing panels |
| `js/contact.js` | Web3Forms submission + UI states |
| `js/boot.js` | Intro overlay |
| `js/yolo.js` | Easter egg |
| `js/main.js` | Ordered, isolated init |
| `assets/img/portrait.webp` | Cut-out portrait (alpha) |
| `assets/img/og.png` | 1200×630 share image |
| `tools/dev-server.mjs` (git-ignored) | Static server + `POST /__save?path=assets/img/<name>` writer |
| `tools/cutout.html`, `tools/og.html` (git-ignored) | Browser-side asset generators |
| `.claude/launch.json` (git-ignored) | Preview server config |

## Cross-module contracts (exact names)

```text
window.ME
  $(sel, root?) -> Element|null          $$(sel, root?) -> Element[]
  clamp(v, lo, hi) lerp(a, b, t) rand(lo, hi) hash01(str) -> number in [0,1)
  reducedMotion() -> boolean              params -> URLSearchParams
  store.get(key, fallback) / store.set(key, value)       keys: "me.theme", "me.booted"
  bus.on(evt, fn) / bus.off(evt, fn) / bus.emit(evt, detail)
      events: "theme" {theme}, "air" AirState, "boot:done" {}, "section" {id}, "yolo" {on}
  ticker.add(fn(dtSeconds, nowMs)) -> removeFn; ticker.fps (smoothed); ticker.frame (int)
  onVisible(el, fn(isVisible, entry), options?) -> disconnectFn
  cssVar(name) -> string (computed from :root)

ME.air
  ready -> Promise<AirState>
  parseCSV(text) -> City[]
  timeLocal(date) -> "HH:MM" in Africa/Cairo
  AirState = { source: "live"|"sample", cities: City[], portSaid: City }
  City = { id, name, pm25, pm10, aqi, category, tempC, humidity, windKmh, observedAt: Date }

ME.theme.get() -> "dark"|"light"; ME.theme.set(theme)          (hud.js)
ME.field.init()                                               (field.js)
ME.hud.init()                                                 (hud.js)
ME.hero.init()                                                (hero.js)
ME.demos.mount(kind, stageEl, { interactive }) -> { destroy() }   kinds: "aqi"|"dog"|"ball"|"schema"
ME.projects.init(); ME.projects.open(slug, { fromEl }); ME.projects.close()
ME.sections.init()
ME.contact.init()
ME.boot.init(); ME.boot.run({ instant }) -> Promise<void>
ME.yolo.init(); ME.yolo.toggle(force?)
```

DOM hooks: sections `#top` (hero) `#about` `#projects` `#resume` `#skills` `#writing` `#contact`;
lock-on headers `.sec-title.det[data-tag]`; project cards `.proj[data-slug][data-demo]` with hidden
`.proj-detail`; demo stage `.stage[data-demo]`; boot overlay `#boot`; field canvas `#field`;
YOLO layer `#yolo`; dialog `#proj-dialog`.

---

### Task 1: Scaffold, tokens, content, core

**Files:** Create `index.html`, `css/tokens.css`, `css/base.css`, `css/layout.css` (stub), `css/components.css` (stub), `js/core.js`, `js/main.js`, `tools/dev-server.mjs`, `.claude/launch.json`; Modify `.gitignore` (add `.claude/`).

- [ ] Write `tools/dev-server.mjs` (static files with correct MIME types, no-cache; `POST /__save?path=` limited to `assets/img/*.webp|png|jpg`).
- [ ] Write `.claude/launch.json` → `node tools/dev-server.mjs` on port 5500.
- [ ] Write `index.html` with the full content of the live site (+ CV additions), semantic sections, inline head script, all script tags.
- [ ] Write tokens + base CSS; core.js per contracts; main.js with isolated init.
- [ ] Verify: start preview, page renders, `ME` exists, toggling `data-theme` swaps palettes, zero console errors.
- [ ] Commit `feat: scaffold content, palette tokens and core runtime`.

### Task 2: Portrait cut-out asset

**Files:** Create `tools/cutout.html`; Output `assets/img/portrait.webp`.

- [ ] Browser tool: load `profile-original.jpg`, crop to head + shoulders, flood-fill near-white background from the borders, erode 1 px, feather 2 px, preview on navy / amber / paper, export WebP (≈1000 px wide) via `/__save`.
- [ ] Verify: file exists, < 180 KB, edges clean on all three grounds (screenshot).
- [ ] Commit `feat: add cut-out portrait`.

### Task 3: Static layout and palette blocks

**Files:** Modify `css/layout.css`, `css/components.css`, `index.html` (SVG duotone filter).

- [ ] Hero (name, role line, lead, CTAs, stats, amber panel + duotone portrait with brackets), about + tiles, project cards with stage placeholders, resume rail, skills groups, writing panels, amber contact block with navy form card, navy footer.
- [ ] Responsive rules for ≤ 1100, ≤ 900, ≤ 600 px.
- [ ] Verify: screenshots at 1440 / 768 / 375 in dark and light; no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] Commit `feat: static layout with navy/amber palette blocks`.

### Task 4: HUD and navigation

**Files:** Create `js/hud.js`; Modify CSS.

- [ ] Theme toggle (persist `me.theme`, emit `theme`), top bar scrolled state, nav active via IO, lock-ons, seek bar ticks + playhead + click-to-jump, REC timer, frame counter, FPS, Cairo clock, viewfinder corners, mobile menu (iris open, Esc, focus return, scroll lock), air chip bound to `air` event.
- [ ] Verify: each control by click + keyboard; mobile menu at 375 px; theme persists across reload.
- [ ] Commit `feat: viewfinder HUD, seek bar and navigation`.

### Task 5: Live air data and background field

**Files:** Create `js/air.js`, `js/field.js`.

- [ ] air.js with 5 s timeout, `?air=offline` override, sample fallback; emits `air`.
- [ ] field.js per spec (density ∝ PM2.5, drift ∝ wind, swirl, cursor detections, idle scanner, adaptive count, hidden-tab pause, reduced-motion static frame, theme colors).
- [ ] Verify: live values in chip match CSV; `?air=offline` shows sample label; detections follow pointer; `ticker` stops while hidden; FPS ≥ 50 on desktop.
- [ ] Commit `feat: background driven by live Port Said air data`.

### Task 6: Hero portrait lock-on

**Files:** Create `js/hero.js`.

- [ ] Confidence jitter 0.96–0.99, bbox coordinate readout, pointer parallax (desktop, not reduced motion), scan-line true-color reveal on hover / focus.
- [ ] Verify: hover reveal, keyboard focus reveal, reduced-motion shows static state.
- [ ] Commit `feat: hero portrait lock-on`.

### Task 7: Project demos and dialog

**Files:** Create `js/demos.js`, `js/projects.js`.

- [ ] Demos `aqi` (from `ME.air.ready`), `dog` (loop while visible, chirp button when interactive), `ball` (physics, tracker, speed-based confidence, drag-throw when interactive), `schema` (hover / auto-cycle highlight).
- [ ] Dialog: FLIP open from card, 3D flip for ← / → and buttons, close via Esc / button / backdrop with reverse animation, focus return, `#/projects/<slug>` deep links + back button.
- [ ] Verify: all 4 cards open; flip wraps both directions; deep link on fresh load; back closes; each demo behaves (drag-throw ball, chirp plays only on click).
- [ ] Commit `feat: interactive project detections`.

### Task 8: Resume rail, skills threshold, writing panels

**Files:** Create `js/sections.js`.

- [ ] Rail fill follows scroll, nodes light when passed; bars animate on first view; slider dims skills below threshold and updates `model.predict(skills, conf=X) → N detections`; writing panels open / close with animated height and `aria-expanded`.
- [ ] Verify: slider by mouse and arrow keys, counts correct at 0.50 / 0.90 / 1.00; panels by click and keyboard.
- [ ] Commit `feat: resume rail, skills threshold and notes`.

### Task 9: Contact form

**Files:** Create `js/contact.js`.

- [ ] Submit via fetch to Web3Forms with sending / success (signal rings) / error states; honeypot kept.
- [ ] Verify with `window.fetch` stubbed for success and failure; native validation on empty / invalid email. No real submission.
- [ ] Commit `feat: contact form states`.

### Task 10: Boot intro

**Files:** Create `js/boot.js`; Modify `index.html` (overlay markup), CSS.

- [ ] SVG board + draggable plug with live cable path, port snap, click / Enter power-on, skip, typed log with air reading, LED-dot → "م." mark assembly, dot iris reveal, `me.booted`, `?boot`, footer reboot, reduced-motion instant path, focus management.
- [ ] Verify: drag (mouse), click, Enter, skip, reload (skips), `?boot`, reboot button, reduced motion emulation.
- [ ] Commit `feat: power-on boot intro`.

### Task 11: YOLO mode

**Files:** Create `js/yolo.js`.

- [ ] Key sequence detection outside inputs, footer hint trigger, labelled boxes for visible elements, scroll / resize tracking, toast with count and measured time, Esc / repeat to exit.
- [ ] Verify: typing in the contact form does not trigger; boxes track on scroll; exit restores page.
- [ ] Commit `feat: yolo mode easter egg`.

### Task 12: Site extras

**Files:** Create `404.html`, `README.md`, `.nojekyll`, `tools/og.html`, `assets/img/og.png`; Modify `index.html` meta.

- [ ] OG image generated in browser and saved; meta (description, OG, Twitter card, canonical, theme-color, favicon); README with structure, editing guide, deploy steps.
- [ ] Verify: 404 page renders standalone; og.png is 1200×630.
- [ ] Commit `feat: 404, share image and README`.

### Task 13: Full QA pass

- [ ] Run the spec's verification list end to end at 1440 / 768 / 375, both themes, reduced motion; axe scan (serious / critical = 0); `curl` every external link and the CV; console clean. Fix and re-verify anything that fails.
- [ ] Commit `fix: QA pass`.

### Task 14: Deploy

- [ ] User creates empty public repo `mazenelnaghy-code.github.io`; confirm push with user; `git remote add origin`, `git push -u origin main`.
- [ ] Verify live URL loads, air fetch works on the live origin, CV downloads; report.
