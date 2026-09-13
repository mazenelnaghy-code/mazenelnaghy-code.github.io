# Live Inference — portfolio design

**Owner:** Mazen Elnaghy · **Date:** 2026-09-13 · **Status:** approved ("just focus on the color palette and make a creative design")

## Goal

Replace the Vercel-hosted portfolio (`mazen-elnaghy.vercel.app`, repo `portfolio1`) with a more interactive,
original site hosted on GitHub Pages at `https://mazenelnaghy-code.github.io/` (repo `mazenelnaghy-code.github.io`).
The site must feel personal to Mazen — an AI / ML engineer who deploys computer vision on edge devices in
Port Said — and must be built around his brand palette.

Inspiration (kept local, never published): a constantly moving background, an interactive lamp intro, and a
page that opens / closes / flips between sections. Each idea is reinvented, not copied.

## Concept

The whole site is Mazen's detector running live on a Raspberry Pi in Port Said.
Visitors switch the device on, then browse a "camera feed" where content gets detected.

## Palette (the core constraint)

Brand primitives come straight from `mark-navy.png` / `mark-white.png`:

| Token | Hex | Source / role |
|---|---|---|
| `--navy` | `#14213D` | logo glyph — brand surface, text on light/amber |
| `--amber` | `#FFC42E` | logo dot — "the machine's attention" |
| `--paper` | `#F4F4F2` | light mark — ink on dark, light-theme ground |

Derived scale (same navy hue): `#060B16` (night-0, boot), `#0A1120` (night-1, page), `#0F192E` (night-2,
surface), `#14213D` (night-3, raised), `#22304F` (night-4, lines), `#34466B` (night-5, strong lines),
`#A7B1C4` (mist-1, muted text), `#7D89A3` (mist-2, dim text, ≥ 4.5:1 on night-1/2).
Amber support: `#FFD563` (hover), `#E0A800` (strokes on light), `#7A5600` (amber-toned text on paper, 6:1).
Error only: `#E5484D`.

Usage rules:
- Dark "night feed" is the default theme; light "day feed" swaps ground and ink.
- Roughly 60 % navy · 30 % paper · 10 % amber. Amber is reserved for detections, the dot, key numbers
  and primary actions — never body text on light grounds.
- **The amber dot is the signature motif**: REC light, Pi power LED, seek-bar playhead, active nav marker,
  full stop after each section title, bullet nodes. The boot ends by assembling the "م." mark.
- **Palette blocks**: the hero portrait sits on an amber panel; the Contact section is a full-bleed amber
  block holding a navy form card (the logo's two colors at architectural scale); the footer is navy in
  both themes.
- **Duotone portrait**: the cut-out photo renders as a navy → paper duotone on the amber panel and
  switches to true color when the detector locks on (hover / focus).

Type: Barlow Condensed 600/700 (display), IBM Plex Sans 400/500/600 (body), IBM Plex Mono 400/500 (HUD).

## Experience

### 1. Boot intro — "Power on"
- Full-screen overlay: line-art single-board computer in the palette (navy board, paper strokes, "م."
  on the SoC), camera module on a ribbon cable, USB-C cable with a draggable plug, pulsing port ring.
- Ways in: drag plug into the port (mouse / touch, snaps within 36 px), click the plug, press Enter,
  or "Skip intro". Hint animation after 2.5 s.
- On power: PWR LED (amber) lights, ACT LED flickers, terminal types ~6 lines including the live
  Port Said reading (or `[warn] offline — cached sample`). The LED dot flies to center and completes
  the "م." mark, then the dot grows into a circular reveal of the site.
- First visit only (`localStorage me.booted`); `?boot` forces it; footer "Reboot device" replays it.
  Reduced motion: boot is skipped on first load; reboot runs with instant transitions.
- Overlay is shown by an inline head script before first paint — no flash of content. No JS → no overlay.

### 2. Background — the real air of Port Said
- `air.js` fetches `https://mazenelnaghy-code.github.io/egypt-air-quality/data/mart_latest_city.csv`
  (CORS `*`, ~1 KB), 5 s timeout, parses all 8 cities; `observed_at` is UTC → shown in Africa/Cairo time.
  Fallback: baked sample (2026-09-13 11:00 UTC) flagged as `sample`.
- `field.js` canvas: particle count ∝ PM2.5 (clamped, scaled by viewport area, lower on mobile),
  PM10 adds fewer, larger motes; drift speed ∝ wind km/h plus a slow swirl so it never stops.
- Cursor = detector: up to 3 nearest particles get amber corner brackets + `pm2.5 0.93` tags
  (confidence rises with proximity). Idle / touch: a virtual scanner roams on a Lissajous path.
- Pauses when the tab is hidden, adapts particle count if frame time degrades, static frame under
  reduced motion, re-reads colors on theme change.

### 3. Viewfinder HUD & navigation
- Top bar: mark + name · nav (About, Projects, Resume, Skills, Writing, Contact; active = amber dot) ·
  live air chip `● LIVE · PORT SAID · PM2.5 16.5 · AQI 61` linking to the dashboard · theme toggle.
- Bottom bar (≥ 900 px): `● REC` + time on page + real frame counter · seek bar with chapter ticks and
  the amber-dot playhead (click tick = jump) · real FPS + live Port Said clock.
- Faint viewfinder corner brackets on the viewport. Mobile: menu button opens a full-screen menu with an
  iris (clip-path circle) transition; 2 px amber progress line at the bottom.
- Section headers "lock on" when they enter view: brackets snap in with tags (`projects · 4 found`).
  Normal native scrolling — no scroll-jacking.

### 4. Sections (content = current live site, plus GitHub links from the CV)
1. **Hero** — `MAZEN / ELNAGHY.` huge; role line `AI ENGINEER · DATA SCIENTIST · DATA ENGINEER`
   (amber dot separators, from the CV); lead "I build AI systems that work outside the lab."; CTAs
   (View detections / Download CV / Say hello); stats 3.95 GPA · #1 in department · 4 projects ·
   8 cities live. Portrait: duotone cut-out on amber panel, lock-on box `mazen_elnaghy 0.99` with
   jittering confidence and live bbox coordinates, subtle pointer parallax, true-color reveal on hover.
2. **About** — lead + paragraphs; 4 "What I do" tiles with class-label brackets on hover.
3. **Projects** — 2×2 detection cards, each with a mini live demo:
   - Air Quality: 8-city AQI bars from the live CSV, Port Said in amber.
   - Dog Deterrent: SVG dog trots in, confidence climbs to `dog 0.94`, speaker waves, dog runs off
     (loops only while visible). Modal adds a "Play deterrent" chirp (Web Audio, click only).
   - Ball Tracking: amber ball with physics + lagging tracker box and trail; confidence drops when the
     ball moves fast. Modal: drag and throw.
   - Prison DB: SVG schema (inmates, cells, staff, visits); hovering / cycling highlights relations.
   - Card opens a native `<dialog>` that grows out of the card rect (FLIP); ← / → flip between projects
     with a 3D page flip; Esc / close / backdrop closes back into the card; deep links
     `#/projects/<slug>` with back-button support.
4. **Resume** — sticky title column + timeline rail whose amber fill follows scroll; nodes light when
   passed. Groups: Experience, Education, Honors & certifications.
5. **Skills** — confidence bars (animate on first view) + threshold slider (`conf` 0.50–1.00) that dims
   skills below it with readout `model.predict(skills, conf=0.90) → 6 detections`.
6. **Writing** — three field notes as accessible open / close panels (first open).
7. **Contact** — amber block, "Send a signal.", direct links (email, LinkedIn, GitHub, CV) and the
   existing Web3Forms form (same access key, honeypot) inside a navy card; sending / success / error
   states, success emits signal rings.
- **Footer** — navy block: mark, name, © year · Port Said, data credit line, Reboot device, Back to top,
  `psst — type "yolo"` hint.

### 5. Easter egg — YOLO mode
Typing `yolo` (outside form fields) or clicking the hint boxes every visible element with a class label
and a stable per-element confidence (`heading 0.98`, `button 0.95`, `person 0.99`), staggered in.
Toast shows object count and the real measured inference time; Esc or `yolo` again exits.

## Architecture

Static, no build step, classic `defer` scripts sharing a `window.ME` namespace (works on GitHub Pages
and from `file://`).

```
index.html            all content (readable without JS), inline head script (theme + boot flag)
404.html              on-brand "no detections · 0.00"
.nojekyll, README.md, .gitignore
assets/img/           portrait.webp (cut-out), mark-navy.png, mark-white.png, og.png
assets/Mazen_Elnaghy_CV.pdf
css/tokens.css        palette, type, spacing, themes
css/base.css          reset, typography, buttons, chips, detection brackets, utilities
css/layout.css        HUD, hero, sections, footer, responsive
css/components.css    boot, projects + dialog + demos, resume, skills, writing, contact, yolo
js/core.js            namespace, helpers, prefs (reduced motion, storage), event bus, shared ticker + FPS
js/air.js             fetch / parse / fallback, ME.air.ready promise
js/field.js           background canvas
js/hud.js             top/bottom bars, clock, seek bar, nav state, section lock-on, mobile menu, theme
js/hero.js            portrait lock-on, jitter, parallax, reveal
js/demos.js           aqi bars, dog, ball, schema
js/projects.js        dialog open / flip / close, hash routing
js/sections.js        resume rail, skills threshold, writing panels
js/contact.js         Web3Forms submit + states
js/boot.js            intro
js/yolo.js            easter egg
js/main.js            init order
```

Excluded from the repo: the inspiration screenshots, `profile-original.jpg`, local tooling.

## Accessibility & performance
- Keyboard path for every interaction; visible focus; native `<dialog>`, range input, buttons with
  `aria-expanded`; skip link; `prefers-reduced-motion` honored everywhere.
- Text contrast ≥ 4.5:1 in both themes; amber never used as small text on light grounds.
- Portrait cut-out ~1000 px WebP; canvas DPR capped at 2; demos and field pause when not visible.
- Meta description, Open Graph image, canonical URL, favicon from the mark.

## Verification (every part, in a real browser)
Boot (drag, click, Enter, skip, returning visit, `?boot`, reboot, reduced motion) · air live + forced
offline (`?air=offline`) · background detections + pause on hidden tab · nav, seek bar, lock-ons, mobile
menu · every project card, open / flip / close / deep link / back button, each demo incl. drag-throw and
chirp · resume rail · skills slider (mouse + keyboard) · writing panels · contact validation + success /
error UI via stubbed fetch (no real message sent) · YOLO mode · both themes · 375 / 768 / 1440 px widths,
no horizontal scroll · zero console errors · axe accessibility scan · every external link and the CV
resolve. Repeat a smoke test on the live GitHub Pages URL after pushing (push only after confirmation).
