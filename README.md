# Mazen Elnaghy — portfolio

**Live:** https://mazenelnaghy-code.github.io/

My portfolio, built like one of my edge deployments. You power the device on, and the page runs as a live
detection feed from Port Said. It's plain HTML, CSS and JavaScript with no framework and no build step,
hosted on GitHub Pages.

## What's in it

- **Power-on intro.** Drag the USB-C cable into the board (or click it, or press Enter). The device boots with a live
  air-quality reading, the power LED flies into the dot of my logo, and the dot opens into the page. It plays
  on the first visit only. Use *Reboot device* in the footer to replay it.
- **A background that never stops moving.** Dust particles drift across the page. How many there are follows the
  current PM2.5 level in Port Said and how fast they move follows the wind. Both values come from my own
  [Egypt air-quality pipeline](https://github.com/mazenelnaghy-code/egypt-air-quality). Your pointer acts as the detector.
- **Viewfinder HUD.** A REC timer, the real frame counter and FPS, a Port Said clock, and a seek bar with a chapter mark for each section.
- **Projects as detections.** Every card runs a small live demo: live AQI bars, a dog detector with a deterrent sound,
  a ball tracker you can throw, and an animated ER schema. Cards open into a dialog that flips between projects
  (← →) and has its own link, `#/projects/<name>`.
- **Skills with a confidence threshold**, like YOLO's `conf=`. Drag the slider and weaker skills drop out.
- **Day / night switch.** A hardware-style toggle with the amber dot as its knob. Flipping it sweeps the new light
  across the page from the switch.
- **Detector cursor.** On a mouse, the pointer becomes a small reticle that locks onto links and buttons and labels
  them (`link 0.94`, `github 0.97`…).
- **Sections come alive.** Blocks rise into frame as you scroll, section titles decode letter by letter, the hero
  numbers count up, cards tilt toward the mouse, and a band of words drifts across the page, faster when you scroll.
- **Easter egg.** Type `yolo` anywhere on the page.
- Every interaction also works from the keyboard. With `prefers-reduced-motion` set, everything stays still.

The palette comes straight from my logo: navy `#14213D`, amber `#FFC42E`, paper `#F4F4F2`.

## Structure

```
index.html              all content + the SVG library (logo, icons, duotone filter)
404.html                self-contained not-found page
css/tokens.css          palette and theme tokens
css/base.css            reset, type, buttons, chips, detection brackets
css/layout.css          HUD, hero, sections, footer, responsive rules
css/components.css      project cards + dialog, demos, slider, form, boot, YOLO layer
css/effects.css         day/night switch, cursor, reveals, tilt, word strip
js/core.js              shared helpers, event bus, one animation loop
js/air.js               live Port Said data (falls back to a saved sample)
js/field.js             moving particle background
js/hud.js               day/night switch, navigation, seek bar, clocks, mobile menu
js/cursor.js            detector cursor
js/reveal.js            scroll reveals, decoding titles, counting numbers
js/tilt.js              tilting cards
js/strip.js             moving word strip
js/hero.js              portrait lock-on
js/demos.js             the four project demos
js/projects.js          project dialog, flipping, deep links
js/sections.js          resume rail, skills threshold, writing notes
js/contact.js           contact form (Web3Forms)
js/boot.js              power-on intro
js/yolo.js              easter egg
js/main.js              starts every module
assets/                 portrait, share image, icons, CV
```

## Editing content

- **Text:** everything lives in `index.html`, one clearly commented block per section.
- **Projects:** each `<article class="proj">` holds a short summary, plus a hidden `.proj-detail` block with
  the full write-up and links. The dialog reads straight from that block.
- **Skills:** change the number in both `data-v` and `style="--v:…"` on a `.sk` row.
- **CV:** replace `assets/Mazen_Elnaghy_CV.pdf` with a file of the same name.
- **Contact form:** it posts to [Web3Forms](https://web3forms.com); the access key is in the hidden `access_key` input.

## Running it locally

Any static server works, for example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Useful URL switches:

- `?boot` always plays the intro
- `?noboot` skips it
- `?air=offline` uses the saved air sample
- `?reduced` previews the reduced-motion version

## Deploying

The site deploys from the `main` branch of the `mazenelnaghy-code.github.io` repository. GitHub Pages publishes
it automatically on every push. If it doesn't, go to **Settings → Pages** and pick "Deploy from a branch", with branch `main` and folder `/ (root)`.

## Credits

Fonts: Barlow Condensed and IBM Plex (SIL Open Font License), served by Google Fonts. Air-quality data:
Open-Meteo, processed by my pipeline.
