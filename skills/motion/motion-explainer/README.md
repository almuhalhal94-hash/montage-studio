<div align="center">

# motion-explainer

**Ask Claude to explain something. Get a motion-graphics animation you can pause, step through and zoom into.**

A [Claude Code](https://claude.com/claude-code) skill. One prompt in, one self-contained HTML player out,<br>narrated in English or Spanish if you want.

[**▶ Live demos**](https://4lxn.github.io/motion-explainer/) · [**Install**](#install) · [Prompts to try](#prompts-to-try) · [Narration](#narration-english-and-spanish) · [Scene format](REFERENCE.md)

[![test](https://github.com/4lxn/motion-explainer/actions/workflows/test.yml/badge.svg)](https://github.com/4lxn/motion-explainer/actions/workflows/test.yml)
[![release](https://img.shields.io/github/v/release/4lxn/motion-explainer?color=0a84ff)](https://github.com/4lxn/motion-explainer/releases)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<a href="https://4lxn.github.io/motion-explainer/login-flow.html"><img src="docs/demo.webp" alt="A motion-explainer animation of a login: a terminal types a curl call, a packet passes through the API gateway, the camera zooms inside the auth service, a latency chart shows bcrypt dominating" width="820"></a>

<sub>Made from one prompt. Click to play it yourself: pause, step, zoom.</sub>

</div>

## One prompt in, one explainer out

**Input**

```text
/motion-explainer Explain a login flow. Icon on every box, a terminal mockup for the curl call,
a latency chart, zoom into the auth service, hud theme.
```

**Output** · [**▶ Watch it**](https://4lxn.github.io/motion-explainer/login-flow.html) (9 steps, 1:16, one 120 KB HTML file) · [scene source](examples/login-flow.scene.js)

| Step | What happens |
|---|---|
| 2 | A terminal types the `curl` call |
| 3 | The request packet passes **through** the API gateway (its outline fills like a progress ring) on its way to the auth service |
| 4 | The camera zooms **inside** the auth service: rate limit → bcrypt → sign JWT |
| 5 | The packet goes into the users database and comes back with the password hash |
| 6 | A latency chart: bcrypt takes ~250 ms of the request, **on purpose** |
| 7–8 | A signed token travels back; later requests only check its signature |

**What Claude did in between**

```text
1. storyboarded 9 steps and checked the facts
2. wrote the scene, built it, linted it in headless Chrome (overlaps, text that doesn't fit, hidden arrows)
3. screenshotted every step and fixed what looked wrong
4. opened the player
```

Another one, from a plain prompt with no graphics named and no edits: [how DNS resolution works](https://4lxn.github.io/motion-explainer/dns-resolution.html), built from a real `dig +trace`.

## Why it's different

| | What it means for you |
|---|---|
| **A player, not a video** | Play, pause, step with `←` `→`, scrub, change speed. Viewers go at their own pace. |
| **Zoom into anything** | Scroll or pinch to zoom, drag to pan, double-click a box to fly into it. Boxes can hold detail that only appears up close. |
| **One HTML file** | Engine, scene and narration inlined. No network, no CDN, strict CSP. Email it, attach it to a PR, open it offline. |
| **Checks its own work** | Every build is linted for overlaps, text that doesn't fit, arrows through boxes and off-canvas elements. Claude reviews a screenshot of every step before you see it. |
| **Narrated, offline** | Local [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) voices in English and Spanish, with a voice picker in the player. Nothing leaves your machine. |

<div align="center">
<img src="docs/sheet.webp" alt="Contact sheet: all 9 steps of the login explainer" width="820">
<br><sub>Every step of the login explainer at a glance (<code>motion shot</code>): the sheet Claude reviews before showing you.</sub>
</div>

## Install

**Needs:** macOS or Linux, Google Chrome or Chromium, `bash`, `openssl`. Nothing from npm or pip.

**Plugin** (Claude Code keeps it updated). In Claude Code:

```text
/plugin marketplace add 4lxn/motion-explainer
/plugin install motion-explainer@motion-explainer
```

**Or git clone** (update with `git pull`):

```sh
git clone https://github.com/4lxn/motion-explainer ~/.claude/skills/motion-explainer
```

Use one or the other; if both are installed, the plugin wins. Then ask:

```text
/motion-explainer how TCP's three-way handshake works
```

Or just say *"animate this architecture"* or *"explícamelo con una animación"*.

<details>
<summary><b>Something not working?</b></summary>

Run `motion doctor` (plugin installs put `motion` on Claude's PATH) or `~/.claude/skills/motion-explainer/bin/motion doctor` (git clone). It checks Chrome, `openssl` and an end-to-end build, and prints the fix for anything missing.

- **Chrome somewhere unusual:** `export MOTION_CHROME="/path/to/chrome-or-chromium"`
- **Windows:** run it inside WSL with Chromium installed. The built HTML plays in any browser on any OS.
- **Ubuntu 24.04 CI or containers:** headless Chrome needs its sandbox allowed: `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` (this repo's CI does the same).
</details>

## Prompts to try

| You want | Ask |
|---|---|
| How a system works | *"/motion-explainer how a request reaches our API: load balancer, auth, cache, database"* |
| An algorithm, step by step | *"animate quicksort on [7, 2, 9, 4, 1, 8]"* |
| An idea that changes over time | *"show why retries without jitter overload a server after an outage"* |
| What went wrong | *"walk through yesterday's outage as an animation, failure path first"* |
| Lots of graphics | *"explain a login flow: icon on every box, a terminal mockup for the curl call, a latency chart, zoom into the auth service, hud theme"* ([result](https://4lxn.github.io/motion-explainer/login-flow.html)) |
| A product or tool | *"explain what Microsoft Access is and its main features, narrated in Spanish"* |
| Onboarding | *"explain our deploy pipeline to a new engineer, with a step for every stage"* |

Graphics are used only where they carry meaning, unless you name them: icons, charts, terminal / browser / phone mockups, kinetic titles, zooms, particles, the `hud` theme or a `glow` backdrop.

Claude reads your code or docs first when the topic is your own system, and says "likely" in the narration for anything it inferred rather than checked.

## Narration: English and Spanish

Each step's narration can be spoken by a local text-to-speech model and embedded in the HTML. Every step waits for its voice to finish.

| Narration language | Voices (picker in the player) | Pronunciation |
|---|---|---|
| English | Heart (`af_heart`) | American English |
| Spanish | Dora, Alex, Santa (`ef_dora`, `em_alex`, `em_santa`) | Latin American (set `lang: 'es-es'` for Castilian) |

Only native voices read each language: an English voice reading Spanish keeps its accent, so `motion voice` picks the right voices from the scene's `lang` (or detects the language) and refuses a mismatch.

**Hear the same explainer in both languages:** [What is Microsoft Access?](https://4lxn.github.io/motion-explainer/what-is-access.html) · [¿Qué es Microsoft Access?](https://4lxn.github.io/motion-explainer/que-es-access.html)

<details>
<summary><b>Set up voice (once, about 270 MB, offline afterwards)</b></summary>

Needs `node`, `ffmpeg` and Python 3.

```sh
APP=~/.claude/skills/motion-explainer   # plugin installs: APP=$(dirname "$(dirname "$(command -v motion)")")
V=~/.cache/motion-voice; mkdir -p "$V"; python3 -m venv "$V/venv"
"$V/venv/bin/pip" install -r "$APP/tools/voice-requirements.txt"
for f in kokoro-v1.0.int8.onnx voices-v1.0.bin; do
  curl -L -o "$V/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done
```

Every dependency is pinned, and the model files are checked against pinned SHA-256 hashes. Then ask Claude to "add narration", or run `motion voice my-topic.scene.js` and build again. More in [REFERENCE.md › Voice](REFERENCE.md#voice-motion-voice-optional).
</details>

## Examples

| Explainer | Shows | Live |
|---|---|---|
| [GitHub Actions runners](examples/gha-self-hosted-runner.scene.js) | architecture, packets along arrows, zooming inside a box | [open](https://4lxn.github.io/motion-explainer/gha-self-hosted-runner.html) |
| [Binary search](examples/binary-search.scene.js) | an algorithm; the steps come from a real run of the code | [open](https://4lxn.github.io/motion-explainer/binary-search.html) |
| [Retries with jitter](examples/retry-jitter.scene.js) | an idea over time, live charts | [open](https://4lxn.github.io/motion-explainer/retry-jitter.html) |
| [From git push to production](examples/showcase.scene.js) | icons, terminal and browser mockups, kinetic type, `hud` theme | [open](https://4lxn.github.io/motion-explainer/showcase.html) |
| [DNS resolution](examples/dns-resolution.scene.js) | **made by the skill from one prompt, unedited**, with real `dig +trace` data | [open](https://4lxn.github.io/motion-explainer/dns-resolution.html) |
| [How a login works](examples/login-flow.scene.js) | **rich visuals from one prompt**: hud theme, terminal that types, icons, zoom inside a service, latency chart, packets passing through components | [open](https://4lxn.github.io/motion-explainer/login-flow.html) |
| [What is Microsoft Access?](examples/what-is-access.scene.js) | a product tour, **narrated** (English) | [open](https://4lxn.github.io/motion-explainer/what-is-access.html) |
| [¿Qué es Microsoft Access?](examples/que-es-access.scene.js) | the same tour, **narrated in Spanish** with three voices | [abrir](https://4lxn.github.io/motion-explainer/que-es-access.html) |

## Player keys

| Key | Does | Key | Does |
|---|---|---|---|
| `Space` | play / pause | `S` | step mode: pause after each step |
| `←` `→` | previous / next step | `[` `]` | slower / faster |
| scroll, pinch | zoom | `T` | light / dark |
| drag | pan | `V` | narration on / off |
| double-click a box | zoom into it | `?` | all keys |

Add `#4` to the URL to open at step 4.

## Write scenes yourself

The skill drives `bin/motion`, and you can too:

```sh
motion new   my-topic architecture   # start from a template: architecture | algorithm | idea | story
motion build my-topic.scene.js       # inline everything into my-topic.html, then lint it
motion shot  my-topic.html           # one PNG with every step (add 4 or 4@1.5 for one step, mid-motion)
motion open  my-topic.html           # chromeless 1440x900 window
motion voice my-topic.scene.js       # narrate, then build again
motion doctor                        # check the setup
```

(`motion` is on PATH with the plugin; with git clone it's `~/.claude/skills/motion-explainer/bin/motion`.)

A scene is a small JS file: declare every element, then the steps that reveal and move them.

```js
Motion.scene({
  title: 'Cache hit vs miss',
  lang: 'en',
  elements: [
    { id: 'app',   type: 'box', x: 300,  y: 450, label: 'App' },
    { id: 'cache', type: 'box', x: 800,  y: 450, label: 'Cache', tone: 'accent' },
    { id: 'db',    type: 'box', x: 1300, y: 450, label: 'Database', shape: 'db' },
    { id: 'a1', type: 'arrow', from: 'app', to: 'cache' },
    { id: 'a2', type: 'arrow', from: 'cache', to: 'db' },
  ],
  steps: [
    { title: 'Ask the cache first', say: 'The app checks the cache before the database.',
      do: [{ show: ['app', 'cache', 'a1'] }, { flow: 'a1', label: 'GET' }] },
    { title: 'Miss: go to the database', say: 'On a **miss**, the cache asks the database and keeps the answer.',
      do: [{ show: ['db', 'a2'] }, { flow: 'a2' }, { flow: 'a2', reverse: true, label: 'row' }, { pulse: 'cache', tone: 'ok' }] },
  ],
});
```

Errors name the scene line and suggest the closest valid name:

```text
error 'cache': unknown type 'bxo'. Did you mean 'box'?
error step 2: unknown id 'dbb'. Did you mean 'db'?
error js: Uncaught ReferenceError: lable is not defined (my-topic.scene.js:14)
```

Elements: boxes, circles, text, arrows, zones, notes, code panels, icons, charts, terminal, browser and window mockups, kinetic titles, particles. Actions: `show`, `hide`, `set`, `move`, `flow`, `focus`, `camera`, `pulse`, `line` and more. The full format is in [REFERENCE.md](REFERENCE.md).

## FAQ

<details>
<summary><b>Does it need the internet?</b></summary>
Only to install. Building, linting, narrating and playing all run locally, and the built page cannot load anything from the network.
</details>

<details>
<summary><b>How do I share one?</b></summary>
Send the <code>.html</code> file, or host it anywhere static (these demos are on GitHub Pages). Silent explainers are about 100 KB; narration adds roughly 1 MB per voice.
</details>

<details>
<summary><b>Can I edit what Claude made?</b></summary>
Yes. Edit the <code>.scene.js</code> (or ask Claude to) and build again. Don't edit the built <code>.html</code>.
</details>

<details>
<summary><b>Why not a video, slides or a diagram?</b></summary>
A video plays at one speed and can't be zoomed. Slides lose the movement. A static diagram shows the parts but not the order things happen in. A step player keeps all three: movement, pacing and detail on demand.
</details>

## How it works

```text
scene.js ──► motion build ──► one .html (engine + scene + voice inlined, hash-pinned CSP)
                                 │
                                 ├─► headless Chrome lint  (overlaps, fit, unknown ids, JS errors)
                                 └─► motion shot           (a PNG per step that Claude reviews)
```

`engine/player.js` compiles the scene into tweens and paints SVG. `bin/motion` is plain bash 3.2. `tools/voice.py` runs Kokoro locally.

## Updating and contributing

- **Update:** `claude plugin update motion-explainer@motion-explainer`, or `git -C ~/.claude/skills/motion-explainer pull`. See [CHANGELOG.md](CHANGELOG.md).
- **Test:** `test/run.sh` lints every example and runs the player, voice, CLI and lint tests. CI runs it on Ubuntu and macOS.
- **Contribute:** issues and PRs welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). The optional voice feature downloads Kokoro weights (Apache-2.0) and uses `phonemizer` / espeak-ng (GPL-3.0); they are not bundled here.
