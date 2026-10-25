# One File Studio

**One skill file that turns Claude Code into a premium creative studio.** It makes scroll-stopping videos (ads, reels,
brand reveals, "made by Claude" motion graphics) and award-level websites, the kind you see on Instagram and think
"who made that?"

Made by **Eli Brandow** ([@doingaiwitheli](https://www.instagram.com/doingaiwitheli/))

---

## What it does

**Videos.** You describe the idea; Claude runs a full production:

1. **15 ideas, scored by a survey** of five viewer types and four director checks. The winner gets written 10 ways and
   cross-checked.
2. **Real photography, Pinterest-first.** Claude finds the look on Pinterest, then generates originals with your logo on
   real cups, bags, trucks, signs and phones. It also makes pixel-aligned before/after pairs for wipe reveals.
3. **A voice with emotion on every line** (ElevenLabs v3): curious, mischievous, excited, a gasp, a real whisper, warm,
   urgent. Three takes per line, scored by numbers, with clipped endings caught automatically.
4. **Every frame animated in code**, timed to the spoken words:
   - kinetic type, glass UI, typing, cursors and Follow clicks
   - logos drawing themselves on construction lines
   - burning-line wipes, boards of every asset wired back to one prompt
   - 3D characters
5. **Sound design on every move**, about 120 effects generated to order, plus location ambience, mastered to
   streaming loudness.
6. **Photoreal footage when the story needs it.** Generated key frames, animated image-to-video (Kling or Seedance),
   then cut, timed and scored in code. The haunted-house reel with a jump scare is the worked example. This part needs
   image and video credits on Higgsfield (about 60 for that reel).
7. **QA before you see it.** Loudness, true peak, black or frozen frames, contact sheets. New hooks and reorders are
   spliced without re-rendering.

**Websites.** Same discipline:
- the business's real brand and verified facts
- three directions shown as hero mockups before anything is built
- one signature interaction that belongs to that business only
- motion with restraint
- the phone number in the first mobile screen
- SEO-ready structure
- QA by script (overflow measured against the container, a checker proven to fail on a broken page) and by eye

## What's inside

```
SKILL.md                    the whole process: two flows, nine laws, quality gates
references/                 the detailed playbook Claude reads when a step needs it
  quality-bar.md              what premium looks and sounds like, and every failure we already paid for
  ideas-and-scripts.md        teardowns, the 15-idea survey, 10 scripts + cross-check, CTA patterns
  pinterest-and-images.md     Pinterest sourcing, rights, branded generation, before/after pairs, green screens
  voice.md                    expressive AI voice: per-line takes, scoring, assembly, processing
  video-engine.md             the code-video engine, 15 scene patterns, the gotchas
  video-3d.md                 3D characters that look like premium toys, rendered for video
  video-ai-footage.md         photoreal shots animated image-to-video, cut in code; scare craft for horror reels
  sound.md                    sound design, cue sheets, levels you can check without ears, mastering
  video-render-qa.md          render, encode, QA, delivery checklist, hook variants and reorders
  websites.md                 award-level website flow, from research to live QA
  setup.md                    tools, keys, costs
scripts/                    15 tested tools: frame renderer, 3D renderer, voice takes / scoring / assembly,
                            sound generation, mixer + mastering, QA, contact sheets, Pinterest extractor,
                            image fetcher, green-screen keyer, website checker, setup check
templates/video/            a working composition (render it in a minute) + a 3D character starter
templates/website/          the plumbing every site needs (reveals, reduced motion, call dock, form, schema)
examples/                   real configs and shot lists from published videos, including the full haunted house
```

## Install

1. Copy this folder to `~/.claude/skills/one-file-studio/`, for every project. To use it in one project only, copy it
   to `<project>/.claude/skills/one-file-studio/` instead.
2. In a project folder, run `bash ~/.claude/skills/one-file-studio/scripts/check_setup.sh` and install whatever it
   marks MISSING.
3. Talal's copy: no keys needed. `pip install edge-tts`. Voice: `scripts/tts_free.py` (Fahed + Ali for dialogue). Effects: `scripts/sfx_synth.py`. See `references/voice.md` and `references/sound.md`.

Then just ask Claude Code. The skill loads on its own:

- "Make a 45-second ad for my taco truck. I want people to comment MENU."
- "Turn this reference reel into our own version, same pacing, our words."
- "Give this video a new 3-second hook and keep everything else."
- "Build a website for my barbershop that looks like the ones on Instagram."
- "Redesign this roofing site; make the phone number impossible to miss."

## Updates

Every new lesson goes into the skill. Each release is listed in `CHANGELOG.md`.

## Community

Questions and results: tag [@doingaiwitheli](https://www.instagram.com/doingaiwitheli/) on Instagram.

## License

Licensed to the purchaser for their own use. What you make with it (videos, sites) is yours. The skill files themselves
may not be shared or resold. See `LICENSE.md`.
