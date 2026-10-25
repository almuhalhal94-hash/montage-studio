---
name: motion-explainer
description: 'Explain an idea, topic, architecture, system or algorithm as a MOTION-GRAPHICS animation in a player app: play/pause, next/previous step, scrub, speed, step mode, zoom in/out (scripted camera plus free zoom/pan; zoom into a component to see inside it). Triggers: /motion-explainer, "motion graphics", "animate this architecture / algorithm / system / flow", "an animation I can pause and step through", "explícamelo con una animación", "animación paso a paso". Not for a static diagram to paste into a doc or ticket, or for anything one sentence answers.'
argument-hint: "[what to explain]"
allowed-tools: Read, Write, Edit, Bash
---

# motion-explainer

You write a **scene** (a small JS file: elements + steps), the app turns it into one
self-contained HTML player and opens it in a chromeless window. The viewer can play,
pause, step with ← →, scrub the timeline, change speed, zoom and pan.

```sh
APP="${CLAUDE_SKILL_DIR}"                              # this skill's folder (plugin or ~/.claude/skills)
[ -x "$APP/bin/motion" ] || APP="$HOME/.claude/skills/motion-explainer"
OUT="${MOTION_OUT:-$HOME/explainers}"; mkdir -p "$OUT"  # durable home for scenes + built HTML
export MOTION_SHOTS="${CLAUDE_JOB_DIR:-${TMPDIR:-/tmp}}/tmp"  # throwaway screenshots
```

If any `motion` command fails with "Chrome not found" or a missing tool, run
`"$APP/bin/motion" doctor` and pass its fix line to the user; don't guess.

## 1. Storyboard before code

Decide, in a few lines in your head (not a file):
- **The point** in one sentence. If you can't say it, you can't animate it.
- **5–12 steps.** Each step is one idea the viewer could repeat back. One step = one
  thing appears, changes or moves, plus ≤ 40 words of narration.
- **The misconception or failure path**, if the topic has one. That step is often
  the most valuable one.
- **Facts.** Only animate what you checked. For the user's own systems, read the code
  or docs first; say "likely" in the narration for a read, not a fact.

## 2. Write the scene

Read `$APP/REFERENCE.md` (the full format), then start from the closest template:

```sh
"$APP/bin/motion" new "$OUT/<kebab-slug>" <template>   # writes $OUT/<kebab-slug>.scene.js
```

| Topic | Template | Example it copies |
|---|---|---|
| architecture, system, request path, infra, "how X reaches Y" | `architecture` | `examples/gha-self-hosted-runner.scene.js` |
| algorithm, data structure, step-by-step computation | `algorithm` | `examples/binary-search.scene.js` |
| idea or principle, behavior over time, load vs capacity, a chart that changes | `idea` | `examples/retry-jitter.scene.js` |
| product or release story, demo, launch: titles, icons, mockups, charts, `hud` theme | `story` | `examples/showcase.scene.js` |
| none of these fit | (omit) | a two-box starter |

Then rewrite it for the topic: keep the structure that fits, replace every element and step. House rules:
- Declare **every** element up front (hidden); steps reveal and change them.
- Color means something: `plain` by default, `ok`/`warn`/`bad`/`accent` for state.
- Show movement with `flow` packets along arrows; use `focus` to point; `camera` for
  "look closer here" moments; `minZoom` insides for "what's inside this box".
- Graphic resources (REFERENCE.md: icons, `title`, `frame`, `chart`, `particles`, kinetic
  text, `glow`, `hud`) only where they carry meaning: an icon names a box, a chart shows a
  number that matters. Decoration never replaces the point.
- For algorithms, run the algorithm in the scene's JS and push steps from it.
- Write in the user's language. No external URLs, fonts or scripts (the CSP blocks them anyway).

## 3. Build until clean

```sh
"$APP/bin/motion" build "$OUT/<slug>.scene.js"     # writes $OUT/<slug>.html, then lints it
```

Errors fail the build (unknown ids, bad verbs, JS errors); they name the scene line and
suggest the closest valid name. Fix every warning
(overlap, text doesn't fit, arrow crosses a box, off-canvas) or know why it's fine.

## 4. Look at it before the user does

```sh
"$APP/bin/motion" shot "$OUT/<slug>.html"          # one PNG: every step's resting state
"$APP/bin/motion" shot "$OUT/<slug>.html" 4        # step 4 at full size
"$APP/bin/motion" shot "$OUT/<slug>.html" 4@1.5    # 1.5 s into step 4: check motion mid-flight
```

Read the PNG. Check: is the canvas used (not a small cluster in a corner)? Is text
readable at 100%? Does the sequence tell the story with the sound off? Do zoomed
steps frame the right thing? Iterate until yes (usually 2–3 rounds).

## 4b. Voice (optional, only when the user asks for narration)

```sh
"$APP/bin/motion" voice "$OUT/<slug>.scene.js"     # local Kokoro voice into $OUT/<slug>.voice/
"$APP/bin/motion" build "$OUT/<slug>.scene.js"     # rebuild: the clips are embedded, steps stretch to fit
```

Set `lang` in the scene when the narration is not English (`lang: 'es'` for Spanish): with no voice given,
`motion voice` then uses that language's native voices (Spanish: Dora, Alex, Santa with Latin American
pronunciation; English: Heart). Don't pass a voice from another language; it is refused because it sounds
foreign. Runs offline from `~/.cache/motion-voice` (setup in REFERENCE.md, Voice). Re-run `motion voice`
after any narration edit; the build warns about clips that are out of date. Never clone or imitate a
real person's voice or a character's voice actor; use the built-in voices.

## 5. Open it and report

```sh
"$APP/bin/motion" open "$OUT/<slug>.html"          # 1440x900 app window; add WxH to change
```

Report in one or two lines: what it explains, the path, and the controls hint:
**Space** play/pause · **← →** step · scroll or pinch to zoom · drag to pan ·
double-click a box to zoom into it · **?** all keys. `#N` in the URL opens step N.

## Anti-patterns

- ❌ Animating what one sentence answers. Answer in chat instead.
- ❌ More than ~12 steps, or narration that reads like a paragraph. Split the topic.
- ❌ Everything colored. Color only the state that matters right now.
- ❌ Arrows for every message. Draw the connection once, `flow` packets over it.
- ❌ Skipping step 4. The lint catches overlaps, not a confusing story.
- ❌ Editing the built `.html`. Edit the `.scene.js` and rebuild.

## Engine notes (when changing the app itself)

`engine/player.js` (compile → tweens → SVG paint; `Player` = controls),
`engine/player.css`, `bin/motion` (bash 3.2). Some Chrome builds never exit in headless
mode, so `bin/motion` polls for the result and kills that throwaway profile.
Run `$APP/test/run.sh` after any engine change: it lints every example and runs
the player control, resource, voice, CLI and lint tests. Icons live in
`engine/icons.js`, which `bin/motion` inlines before the player.
