# The video engine

Videos are web pages rendered frame by frame. The page builds every scene once. The renderer then asks for one time
`t` at a time, and the page sets everything from `t` alone. Nothing depends on the previous frame, so any frame can be
rendered in any order, at any resolution, as often as needed.

Start every project by copying `templates/video/` into the project root (it holds `src/` and `assets/`), then run `bash scripts/get_vendor.sh .` for GSAP and three.js.

## Architecture

| File | Role |
|---|---|
| `index.html` | Layers: `#scenes` (DOM scenes) → `#seq` (image-sequence layer, e.g. 3D) → `#hud` (captions, labels) → `#flash` → `#vig` → `#grain` |
| `data.js` | Written by a script: `window.DATA = {words, lines, dur, ...}`. Timing comes only from here. |
| `engine.js` | One paused GSAP timeline `A.TL`, plus the helpers below and per-frame "drawers" |
| `scenes/*.js` | One file per scene. Each calls `A.build(() => { ... })` |
| `boot.js` | Loads fonts and images, runs the builders, exposes `window.renderFrame(t)` and `window.__ready` |

`renderFrame(t)` does three things:
1. seeks the timeline to `t`
2. runs every drawer, for canvas work and typing (async drawers may return a promise, e.g. image decodes)
3. waits two animation frames

The renderer then captures the viewport.

## Timing: everything is a word

```js
A.ws('hook', 0)   // start of word 0 of line "hook"
A.we('free', -1)  // end of the last word of line "free"
K.flare = A.ws('built', 0) + .02;   // named anchors go in A.K
```

- **Never hard-code seconds** for anything tied to speech.
- Put every important moment in `A.K`, and dump it (`render.mjs --dump plan/anchors.json`). The sound mix reads the
  same anchors, so picture and sound always agree.
- When a line is re-recorded, the whole video re-times itself.

## Helpers (in `templates/video/engine.js`)

| Helper | What it does |
|---|---|
| `A.el(html, parent)` | Create an element |
| `A.on(el, t)` / `A.off(el, t)` | Show or hide a scene at `t` |
| `A.split(el)` / `A.chars(el)` | Wrap words or characters in spans |
| `A.blurIn(els, t, {dur, y, blur, stagger, scale})` | The premium entrance. Sets the from-state at build time, so nothing shows early |
| `A.sync(spans, line, firstWord)` | Each span blurs in 0.14 s before its word is spoken |
| `A.enter(el, from, to, t)` | Any entrance, from-state applied immediately |
| `A.typer(el, text, t0, t1, {caret})` | Human-rhythm typing; returns per-character times for typing sounds |
| `A.caption(line, {hl:[i]})` | Word-synced lower-third captions, keyword colored |
| `A.quad(w, h, [TL, TR, BR, BL])` | `matrix3d` that maps a w × h element onto any four corners |
| `A.photoCam(stage, {z, x, y})` | Camera over a large photo stage (cover-fit × z) |
| `A.embers(canvas, opts)` | Deterministic rising embers or particles |
| `A.clipPlayer(img, schedule)` | Plays existing footage (a frame sequence) on one `<img>`, on a schedule of clips; holds first and last frames outside each window |
| `A.addDraw(fn)` | Per-frame drawer. **Write state for every t**; no early `return` that leaves stale state |

## Scene patterns that worked (mix and match)

| Pattern | How |
|---|---|
| Cold open + rewind | Show the finished payoff ~0.8 s, then a VHS rewind: horizontal slice jitter, scanlines, "◀◀ REWIND", embers running backwards, a white flash, the "before" state |
| Sky pull-back | A real landscape photo starting at scale 1.95 inside the sky, easing to the full view while the first line blurs in |
| Spec card | A dark glass card listing what's missing ("NAME none, LOGO none") that fills on the words |
| Typing in a composer | A chat-style box types the prompt in human rhythm; Send press + ripple; the camera dives into the final character |
| Logo on construction lines | An ember flares; guide circles, baselines and pen-tool handles draw on (stroke-dashoffset); the shape fills bottom-up; flames grow from their base with overshoot; the wordmark blurs in letter by letter |
| Palette flood | Swatch columns rise on stagger with names and hex codes; the hero color expands to fill the frame; flame shapes flicker |
| Mockup montage | One real photo per spoken word, each with its own transition (whip pan, iris from the logo, slide-up phone with a live site scrolling), a numbered brand-kit label |
| Burning-line wipe | A glowing vertical line sweeps across a pixel-aligned before/after pair, with sparks along it and a flash at the end |
| Board + wires | The camera pulls back from full-frame into a bento board of every asset; wires draw from each tile to one prompt card |
| Editor reveal | The board shrinks into an editor window: code writing itself, a render counter, a timeline with a playhead ("even this video") |
| Laptop in the clouds | A real laptop photo re-projected straight-on; the UI mapped onto its screen with `quad()`; push in to type, pull back to reveal |
| Ad inside the ad | A second, higher-energy voice; full-screen site heroes with bracket labels; a 3D carousel; a pixel-resolve lockup |
| CTA sequence | "Want it?" big type → profile card (cursor clicks Follow → "Following ✓") → the comment box types the keyword → the DM drops in with a file chip |
| Limited-spots beat | Make the limit physical (the number assembles, fills or counts down) and flip a price state when the line turns |
| Before/after card | Old work plays in a dull grey card, freezes on the last word (record scratch, buffering spinner, picture drains to grey), then a green line wipes the same card into the new work (`clip-path: inset()` + a glowing bar), the world turns from grey to brand color, and fast labeled cuts follow |
| Phone wall | Five CSS phones in perspective (center front, two angled, two blurred behind) rise on the payoff word; each screen is a tall full-page capture of a live site scrolled with eased flicks; on exit they are pulled into the next object |
| End card | Avatar ring, handle, a big "Comment KEYWORD" button with the character standing on it, fine print |

## Footage and live sites inside a scene

**Footage** (your old videos, a client's clips, earlier renders):
1. Cut each moment to a frame sequence at the composition's fps and the size it will show at:
   `ffmpeg -ss 22.5 -t 1.1 -i source.mp4 -vf "fps=30,scale=960:540" -q:v 3 assets/clips/truck/f%03d.jpg`
2. Play it with `A.clipPlayer(img, [{c: 'truck', n: 33, t0: K.wipe, t1: K.cut1}, ...])`. Keep the times on anchors so the
   cuts follow the voice.
3. Look at a strip of every clip before using it. Leave out frames that show numbers, claims or branding the new piece
   must not repeat.

**Live sites on phones:** `node scripts/capture_sites.mjs https://site.com/=name` saves a full-page phone capture
(390 css px at 2x) with reduced motion on, so every scroll reveal is in its final state, after scrolling the page end to
end so lazy images load. Crop the capture to the part you will scroll through, put it in a CSS phone's screen and move it
with eased `y` tweens like a thumb flicking. Never show a real business's site as the "bad" example: build a dated
mock for a made-up business instead.

**Live sites in motion** (scroll-linked animation, WebGL, video heroes): `node scripts/site_film.mjs <url> out.mp4
--wait 10 --dur 6` records the real page scrolling. It runs full Chrome on the GPU, sends real mouse-wheel events (so
smooth-scroll libraries respond) and keeps the compositor's own frames (about 80 fps on a recent Mac), cropped to the
viewport and written at a constant 30 fps. Cookie banners are hidden with CSS, never accepted or declined.
- **Other studios' sites:** credit them on screen. A browser frame whose address bar shows the domain does it
  cleanly.
- **Gates:** skip sites behind age gates or "enter" screens rather than clicking through them.

## Gotchas (each cost a debug session)

- **GSAP filter tweens from `none` start at zero.** `to(el, {filter: 'brightness(.4) blur(8px)'})` on an element with
  no filter flashes black (brightness 0). The same happens when the start string lacks a function the end has
  (saturate). Always use `fromTo` with explicit values: `'brightness(1) blur(0px)'`.
- **Defaults:** `immediateRender: false` on the timeline, from-states set with `gsap.set` at build time. Otherwise words
  appear before their tweens.
- **Gradient text** (`background-clip: text`) disappears when its child spans are transformed. Put the gradient class
  on each word span.
- **Image stretching:** never pair `width`/`height` attributes with `max-width: 100%` unless you also set
  `height: auto`.
- **Fonts:** await `document.fonts.load()` for every face and weight before `__ready`. A late font shifts text between
  frames.
- **Stills mode** renders times out of order. Drawers must not skip updates outside a time window; set state for
  every `t`.
- **Contact sheets lie at small sizes.** Check full-size frames at every hook, CTA and transition.
- **Captions on light shots** need a dark glass band. White text with a shadow is not enough on white UI.

## Gotchas (found 10/12)
- **Gradient text per word:** `background-clip: text` on a parent paints its gradient over every child glyph, ignoring the children's
  opacity and filters, so words appear early (and vanish once a child gets a `filter`). Put the gradient on each `.w` word span.
- **Filters from "none":** tweening `filter` from an unset value makes GSAP dip through `brightness(0)` for a frame (a near-black flash in QA).
  Always `fromTo` with an explicit start (`'blur(0px) brightness(1)'`).
- **Frame 0:** `A.on(scene, 0)` lands a hair after 0, so frame 0 renders empty. Show the opening scene with `gsap.set(el, { autoAlpha: 1 })` at build.
- **Negative timeline positions:** GSAP can't start a tween before 0; start snaps at 0 and let the first word sit already landed.
- **Marker paths:** round line caps leave a dot at the start of a dash-hidden stroke; keep the path at opacity 0 until its draw starts.
