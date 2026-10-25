# Scene format

A scene is a plain JS file that ends with one `Motion.scene({...})` call. Because
it is JS, you can compute layout and generate steps with loops (see
`examples/binary-search.scene.js`, where the steps come from a real run of the
algorithm).

```js
Motion.scene({
  title: 'How X works',          // intro card + window title
  subtitle: 'One line, **bold** and `code` allowed',
  eyebrow: 'System',             // small kicker above the title
  size: [1600, 900],             // canvas units (default); keep 16:9
  theme: 'dark',                 // 'light', or 'hud' (broadcast frame: corners, step slate, timecode); T toggles light
  backdrop: 'dots',              // 'grid', 'glow' (soft accent light behind dots) or 'none'
  lang: 'es',                    // narration language: picks native voices and accent ('es' Latin American, 'es-es' Castilian, 'en')
  elements: [ /* everything that can ever appear, hidden until shown */ ],
  steps: [ { title, say, do: [ /* actions */ ], hold } ],
});
```

## Canvas and coordinates

- 1600×900 units. `x, y` is the **center** of an element (text: its anchor).
- Keep content inside x 60–1540, y 60–840. The caption band sits *below* the
  canvas, so nothing is covered by narration.
- Readable sizes at 100% zoom: labels ≥ 18, sub-labels come out at 0.68× the label.
- Layout tip: decide columns first (e.g. x = 200, 640, 1250), then rows.

## Elements

Common fields: `id` (required, unique, not `all`/`canvas`), `type`, `x`, `y`,
`tone`, `on: true` (visible from t=0), `alpha` (opacity multiplier),
`minZoom` / `maxZoom` (semantic zoom, below), `fx` (default entry effect),
`glow: true` (soft glow on a box, arrow, icon or chart).
`layer`: drawing order, 0 (back: zones, frames) to 3 (front: notes, text); arrows default to 1, under boxes (2),
except zoomed-in (`minZoom`) arrows, which draw with the boxes so they show over the box they sit in.

| type | fields | notes |
|---|---|---|
| `box` | `w`=200 `h`=90 `label` `sub` `icon` (a name from Icons, below, or an emoji) `size`=22 `subSize` `radius`=14 `shape`: `rect` \| `pill` \| `db` \| `diamond` | `labelMaxZoom`: label fades when zoomed past it. Bars in a chart: `radius: 3`, no label |
| `circle` | `r`=44 `label` `sub` (drawn below) `size` | nodes in graphs, states |
| `text` | `text` `size`=24 `weight` `align`: `middle` \| `start` \| `end` `maxw` (wrap) `mono` `markTone`=`warn` | `tone: 'dim'` for captions; `set: id, mark: 1` sweeps a highlighter behind it |
| `title` | `text` `kicker` (small caps above) `size`=64 `align`=`start` `maxw` | headline with an accent bar; enters word by word (`fx: 'words'`) |
| `icon` | `name` (see Icons) `size`=48 `label` (below) | a line icon on its own; `set: id, name: 'x'` swaps it |
| `frame` | `kind`: `window` \| `terminal` \| `browser` \| `phone` `w` `h` `title` (title bar or URL) `lines: []` `size`=16 `mono` `typed`=1 | device mockup; put other elements inside it. `typed: 0` + `set: id, typed: 1` types the lines; a line starting with `$ ` is a prompt |
| `chart` | `kind`: `bar` \| `line` \| `spark` `data: []` `labels: []` `fmt`=`'{}'` `decimals` `max` (top of the scale) `values` | grows in on show; `set: id, data: [...]` (same length) tweens it. Bars show values unless `values: false`; lines only with `values: true` |
| `particles` | `w`=600 `h`=400 `n`=40 `mode`: `drift` \| `rise` \| `burst` `size`=2.5 `speed`=1 | ambient dust, or a one-shot burst (`show` with `dur`). Drawn with zones and frames in declaration order: declare dust before the frames it should sit behind |
| `zone` | `w` `h` `label` (top-left, caps) | dashed container: VPC, account, host, team |
| `arrow` | `from` `to` (ids or `[x, y]`) `fromOffset` `toOffset` (`[dx, dy]` from the element's center) `label` `labelAt`=.5 `labelSize`=14 `bend` (-1…1) `dashed` `both` `head: false` `width`=2.5 `gap`=8 | ends clip to the shapes and follow them when they move. Many arrows into one box: give each a `toOffset` so the heads don't stack. `head: false` + `[x, y]` ends = a plain line (axis, threshold) |
| `code` | `lines: []` `title` `size`=17 `w` `h` (auto) | highlight a line with the `line` verb |
| `note` | `text` `title` `w`=320 (height auto) `size`=17 | callout with a tone bar |

A numeric `value` with `fmt: '{} ms'` (and `decimals`) renders as text and
tweens smoothly with `set: id, value: n` (counters, latencies, totals).

**Tones** (color = meaning): `plain` (default), `muted`, `accent` (blue; orange in `hud`),
`ok` (green), `warn` (yellow), `bad` (red), `info` (purple), `teal`, `orange`,
`pink`, `fg`, `dim`, or any `#hex`. Keep most things `plain`; color what matters.

## Steps

```js
{ title: 'Short noun phrase', say: 'Narration, ≤ 40 words, **bold** and `code` ok.', do: [ ... ], hold: 2 }
```

`hold` (seconds after the last animation) defaults to reading time. Each step
ends in a **rest state**: that is where → stops, what `#3` links to, and what
the lint and screenshots check.

## Actions (one verb per object)

Actions run **one after another** by default. Add `with: true` to start
together with the previous action, or `at: 1.2` (seconds into the step) for
exact timing. Every action takes `dur` (seconds) and most take `ease`
(`inOut` default, `out`, `in`, `linear`, `back`, `bounce`, `elastic`, `anticipate`).

| verb | example | effect |
|---|---|---|
| `show` | `{ show: ['a', 'b'], fx: 'pop', stagger: .1 }` | fx: `pop` (boxes), `bounce`, `zoom` (lands from big), `draw` (arrows), `grow` (charts), `up` (text), `fade`, `down`, `left`, `right`; text and titles also `type`, `words`, `scramble` (their default `dur` follows the text length) |
| `hide` | `{ hide: 'a' }` | fades out (or any fx) |
| `set` | `{ set: 'a', tone: 'ok', label: 'done', sub: '…', value: 42, alpha: .3, w: 300 }` | tweens `x y w h r value alpha mark typed`, chart `data`, blends `tone`, swaps `label sub text icon name` mid-way; takes a list of ids (grow a bar: `h` + `y`) |
| `move` | `{ move: 'a', x: 900 }`, `{ move: ids, dx: 40 }`, `{ move: 'ptr', to: 'cell3', dy: -80 }`, `{ move: { a: { x: 10 }, b: { dy: 40 } } }` | arrows attached to it follow; the object form moves many elements to different places at once |
| `swap` | `{ swap: ['a', 'b'] }` | exchange positions on arcs (sorting) |
| `highlight` | `{ highlight: 'a', tone: 'bad' }` / `{ unhighlight: '*' }` | glowing outline (persists) |
| `focus` | `{ focus: ['a', 'b'] }` / `{ unfocus: true }` | dims everything else; arrows between focused ids stay lit |
| `flow` | `{ flow: 'e1', label: 'token', count: 3, reverse: true }`, `{ flow: ['e1', 'e2', 'e3'] }` | glowing packet along an arrow; a list = one packet along a route. It pops out of its source and lands with a ripple. Where two arrows meet at a component (in one list, or two flows less than 2.5 s apart), the packet goes **inside** it while its outline fills like a progress ring, then leaves on the next arrow |
| `pulse` | `{ pulse: 'a', tone: 'warn' }` | one expanding ring |
| `camera` | `{ camera: 'a' }`, `{ camera: ['a', 'b'], pad: 80 }`, `{ camera: 'all' }`, `{ camera: 'canvas' }`, `{ camera: { x, y, zoom: 2 } }` | scripted zoom/pan; viewers can still zoom freely and press 0 to rejoin |
| `line` | `{ line: 'code', n: 3 }` (0 = none) | moves the code highlight |
| `wait` | `{ wait: 1 }` | pause inside the step |

## Icons

24×24 line icons drawn for this engine (`engine/icons.js`). Use the name in a box (`icon: 'server'`)
or as an `icon` element. An unknown name that looks like one (`icon: 'servr'`) is drawn as text
and warns.

`server` `database` `cloud` `laptop` `phone` `user` `users` `lock` `unlock` `key` `shield`
`shield-check` `queue` `layers` `gear` `git-branch` `git-commit` `git-merge` `pull-request`
`terminal` `code` `bug` `check` `x` `clock` `alert` `info` `file` `folder` `mail` `message`
`globe` `network` `cpu` `package` `rocket` `zap` `search` `chart` `link` `refresh` `eye` `bell`
`play` `pause` `wifi` `plug` `robot` `sparkles` `headphones` `book` `flag` `pin` `upload`
`download` `trash` `star`

## Semantic zoom (zoom in to see inside)

Give an element's insides `minZoom: 2.8`: they stay invisible until the view is
zoomed in that far (by a `camera` step or by the viewer). Give the outer box
`labelMaxZoom: 2.2` so its own label fades out as the insides fade in. Draw the
insides at small sizes (size ≈ 10–12, `labelSize` ≈ 7 on arrows, `width` ≈ 1)
inside the outer box's rectangle; at 3× they read as normal text. They still
need a `show` before they can appear. See mac-01 in
`examples/gha-self-hosted-runner.scene.js`.

## Patterns

- **Misconception step**: show the wrong mental model, then correct it with
  `set … tone: 'bad'` + a `note` saying what really happens.
- **Failure path**: a late step that turns things `warn`/`bad`, `pulse`s the
  failing part and `focus`es the blast radius.
- **Algorithm**: simulate the algorithm in JS and push one step per decision,
  so the animation is the algorithm.
- **Packets**: `flow` over existing arrows instead of adding new arrows for
  every message.

## Lint (`motion check`)

Errors (build fails): unknown ids, bad types, an action without exactly one
verb, a scene with no steps, unknown icon names (also in `set`), a chart with no
data, `set data` of the wrong length, JavaScript errors, CSP violations.
Warnings (fix, or say why they are fine): overlaps, elements off the canvas,
arrows crossing a box, arrow labels hitting a box, text that does not fit,
visible arrows with hidden ends, zone labels covered by their contents,
frame lines that don't fit, narration over 60 words, unknown themes, backdrops,
chart or frame kinds and particle modes. Elements with `minZoom` are checked as the insides of the
element around them: their text must fit, they must stay inside it, must not overlap each other, and their arrows
must not hide under it. Skipped by the layout checks: elements with `alpha` ≤ .05 (e.g. empty bars), particles,
and crossings of `head: false` lines.
Elements inside a `frame` count as contained, like inside a `zone`.

`motion shot file.html 3@1.5` captures step 3 at 1.5 s in, to check motion
(packets in flight, stagger) that rest-state screenshots can't show.

## Voice (`motion voice`, optional)

Narrates each step's `say` text with a local text-to-speech model and embeds the audio in the HTML.
Nothing is fetched at build or play time; the player's CSP stays `default-src 'none'`.

- Output: `<name>.voice/<voice>-step-N.m4a`, `voice.json` (model, voices, effect, clip lengths) and `voice.js`.
  `motion build` inlines `voice.js` when it exists; each step holds until its longest clip ends.
- Player: the current step's clip follows play, pause, seek and speed. **V** or the Voice button mutes.
- Voice: `motion voice <scene> [voice[,voice...]] [speed]`. With no voice, the scene's language picks its
  **native** voices: English `af_heart`; Spanish `ef_dora`, `em_alex`, `em_santa` (all three, as a picker).
  Language comes from the scene's `lang`, or is detected from the narration. Spanish uses Latin American
  pronunciation by default; `lang: 'es-es'` switches to Castilian.
- Only native voices read a language (the first letter of a voice is its language: `a`/`b` English,
  `e` Spanish). An English voice reading Spanish keeps its English accent, so `motion voice` refuses the mix
  and names the native voices to use instead.
- Several voices = a voice picker in the player (names shown as Dora, Alex, Santa…); the first plays by
  default. Sentences get a short pause between them. Other English voices: af_alloy af_aoede af_bella
  af_jessica af_kore af_nicole af_nova af_river af_sarah af_sky; UK bf_alice bf_emma bf_isabella bf_lily.
  A light chorus, room and treble lift (`EFFECT` in tools/voice.py) gives the synthetic "AI" sheen.
- Setup, once (about 270 MB in `~/.cache/motion-voice`):

```sh
APP=~/.claude/skills/motion-explainer   # the skill folder; plugin installs: APP=$(dirname "$(dirname "$(command -v motion)")")
V=~/.cache/motion-voice; mkdir -p "$V"; python3 -m venv "$V/venv"
"$V/venv/bin/pip" install -r "$APP/tools/voice-requirements.txt"   # every dependency pinned
for f in kokoro-v1.0.int8.onnx voices-v1.0.bin; do
  curl -L -o "$V/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done
```

  tools/voice.py refuses model files whose sha256 differs from the pinned values.
- Each clip stores the narration it was made from; if a step's `say` changes, the build drops that
  clip and warns "out of date", so run `motion voice` again after editing narration.
- `motion voice` reads the scene by running it in Node (not sandboxed like the browser build), so
  only use it on scenes you wrote.
- Licenses: Kokoro weights Apache-2.0; `phonemizer` and the bundled espeak-ng are GPL-3.0; check those terms before
  redistributing narrated explainers.
