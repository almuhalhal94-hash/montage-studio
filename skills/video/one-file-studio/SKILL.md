---
name: one-file-studio
description: "Turns Claude Code into a premium creative studio for two jobs. VIDEOS: ads, reels, brand reveals, 'made by Claude' motion graphics, before/after and list videos, built frame by frame in code with real or generated photography, an expressive AI voiceover with a different tone per line, sound design on every move, and a mastered, QA-checked render. WEBSITES: award-level sites for brands and local businesses with real imagery, one signature interaction, motion with restraint, mobile-first conversion and SEO-ready structure. Finds photos and design references Pinterest-first. Use whenever the user asks to make, script, animate, voice, edit, re-hook or render a video or reel, or to design, build or redesign a website or landing page."
---

# One File Studio

This skill runs a small creative studio inside Claude Code: idea, script, voice, picture, sound and site, all held to one
bar: **stop the scroll, then survive a close look.** Everything below exists because a cheaper shortcut was tried and
looked cheap.

Two flows live in this file. Pick one, follow it in order, and open the reference files when a step points to them.

| The user wants... | Run | Main references |
|---|---|---|
| a video, reel, ad, hook, motion graphic, brand reveal | **Video flow** | `references/video-*.md`, `references/voice.md`, `references/sound.md` |
| a website, landing page, redesign | **Website flow** | `references/websites.md` |
| both share | ideas survey, Pinterest-first images, quality bar | `references/ideas-and-scripts.md`, `references/pinterest-and-images.md`, `references/quality-bar.md` |

---

## The nine laws (every job)

1. **Ideas before pixels.** Generate many ideas, score them, pick one, then write several versions of the script or
   plan and cross-check them (`references/ideas-and-scripts.md`). Small jobs scale this down. No job skips it.
2. **Show early, build once.** Style frames, a voice sample, a hero mockup or a contact sheet goes to the user before
   the expensive step. "They'll love it when it's finished" is the trap.
3. **Real images beat drawn ones.** Photography (found on Pinterest, shot by the client, or generated with the brand
   applied) is what makes code-built work look expensive. Code draws the motion, the UI and the type.
4. **Everything is anchored.** In video, every move is timed to a word of the voiceover. On a website, every claim and
   feature is tied to a real fact about the business. Nothing floats free.
5. **Restraint.** One accent color, one glow, one signature move per piece. A new transition on each beat, never the
   same trick twice in a row. Give people time to read.
6. **Measure what you cannot perceive.** You cannot hear and you cannot feel motion. Measure loudness, voice takes,
   pacing, overflow, file sizes and frame stats. Never guess a number you can measure.
7. **Look before you claim.** Render stills and contact sheets, screenshot at real phone sizes, open the actual
   output. A check that has never failed has not been tested.
8. **Honest by default.** No invented numbers, results, reviews, client counts or testimonials. Hype in a hook is fine;
   facts are verified. Never copy another creator's words, shots, characters or voice.
9. **Leave a trail.** `STATUS.md` says where the job stands and what comes next (a fresh session can pick up from it
   alone). `JOURNAL.md` records each decision and why. `credits.json` lists every outside asset with its source and
   whether it may be published. Each delivered cut gets the next number; a cut the user approved stays untouched.

---

## Video flow

**House rule (Talal's copy): no music, ever.** No instruments, no melodies, no songs, no drum or percussion loops, no musical stingers. Sound comes from the voice, single sound effects tied to on-screen moves (whoosh, click, pop, door, wind, heartbeat), and place ambience. When the user wants a background bed, use only a calm, voice-only Islamic bed (a nasheed with no instruments and no rhythmic percussion, or soft dhikr) that he supplies or approves, sitting well under the voice. Never put Quran recitation under an ad or as a bed. This rule beats any example in this folder.

**Talal's copy: free voice and effects, Arabic first.** Voice with `scripts/tts_free.py` (Fahed `ar-KW-FahedNeural` narrates; for dialogue the second voice is Hamed `ar-SA-HamedNeural`), effects with `scripts/sfx_synth.py`, natural sounds from Pixabay. Never ask for an ElevenLabs key. Wherever this skill says `tts_takes.py` or `sfx_gen.py`, use these two instead. Scripts and captions are in Arabic by default.

Read `references/quality-bar.md` once before your first video in a session.

1. **Brief.** Get: platform and aspect (16:9 for "filmed off a monitor" Claude reels, 9:16 for native reels and
   before/after stacks), target length (15-30 s list/loop pieces, 40-55 s story ads), the CTA keyword, voice preference,
   background bed yes/no (voice-only Islamic bed only; never music), brand assets, and any reference video.
   If there is a reference, tear it down first: a shot table with times, transitions, text, voice tones, sound events
   and the CTA. Study it, never copy it (`references/ideas-and-scripts.md` → Teardown).
2. **Ideas.** 15 ideas → a scored survey (5 viewer personas + 4 director checks) → one winner, with the runner-up's best
   device borrowed.
3. **Script.** 10 versions of the winner → cross-check table (hook, arc, clarity, ask, fit, honesty, novelty, ending)
   → final script with **one tone tag per line** and a shot for every line. Show it.
4. **Brand and images.** If the piece invents a brand, design its logo as SVG in code (simple geometry, one color) and a
   5-color palette. Then images, Pinterest-first: `references/pinterest-and-images.md`. Real-looking places, creatures
   or products that must move (a haunted house, a launch film): generate key frames, animate them image-to-video,
   then cut them in code: `references/video-ai-footage.md`.
5. **Voice.** One request per line, three takes each, scored by script, never by vibe: `references/voice.md`.
   Assemble with picture-driven gaps. Write `plan/vo_words.json`. This file drives all timing.
6. **Build.** Copy `templates/video/` into the project and write scenes as functions of time, anchored to words:
   `references/video-engine.md`. Characters in 3D: `references/video-3d.md`.
7. **Stills loop.** Render stills at the key words (`node scripts/render.mjs --times ...`), build a contact sheet
   (`python3 scripts/contact_sheet.py`), look at every frame, fix, repeat. Most quality is won here.
8. **Sound.** A sound on every move, generated to order. Location beds where a place is shown. Speech always on top.
   Master to -14 LUFS and ≤ -1.5 dBTP: `references/sound.md`.
9. **Render and QA.** Full render, encode, then `python3 scripts/qa.py <mp4>` for loudness, black frames, frozen frames
   and contact sheets: `references/video-render-qa.md`.
10. **Deliver.** The full file, a phone-size copy, the script, and the thing the CTA promises (the prompt, the file,
    the guide). If the video says "comment X and I'll send it", that asset must exist before posting.
11. **Iterate.** Sort the notes by impact, fix the biggest first, re-render only the affected range. Test a new hook by rendering just the new
    opening and splicing it onto the approved video (`references/video-render-qa.md` → Variants).

## Website flow

Follow `references/websites.md` step by step. In short:

1. **Cast and brief.** You are an award-winning designer who takes criticism of every detail. One subject, one
   audience, one job for the page.
2. **Research.** The business's real brand, photos and facts (verified from primary sources). 6-10 visual references
   from Pinterest, Instagram and award galleries.
3. **Directions.** Three directions as cheap hero mockups. The user picks before anything is built.
4. **System.** 4-6 named colors, 2-3 fonts, one signature interaction that belongs to this business only, a motion
   budget.
5. **Media.** Client photos first, then licensed, then generated with their brand applied. Pinterest-first for
   direction.
6. **Build.** Static, fast, mobile-first. The phone number or booking control lives in the first mobile screen.
7. **Structure for search.** One h1, real titles and descriptions, question headings, schema, sitemap.
8. **QA by eye and by script.** Screens at 375, 390 and 1440; overflow measured against the container; reduced motion;
   Lighthouse.
9. **Deploy and verify** the live URL with your own eyes.

---

## Pinterest-first imagery (both flows)

Pinterest is where the best real-world photography and design direction is. The method in
`references/pinterest-and-images.md`:

1. Search with 3-6 specific queries, through the user's browser or a browser MCP.
2. Run `scripts/pinterest_extract.js` on the results page to list the original-size images.
3. Keep only large, sharp images that fit the story, and download them with `scripts/fetch_images.py`, which logs each
   one in `credits.json`.
4. Look at every image before using it.

Rights decide the final step:
- **Client or own photos:** use them.
- **Licensed or CC0:** use them, credited.
- **Pinterest finds:** direction and test cuts.
- **Published work:** use originals generated from the Pinterest direction, with the real logo applied.

---

## Quality gates (stop if any fails)

**Video:**
- The first frame works as a thumbnail.
- The first spoken word lands by 1.3 s.
- Every line's ending is intact.
- Captions are readable at phone size.
- A sound sits on every cut.
- -14 LUFS.
- No black or frozen frames except deliberate ones.

**Website:**
- A call or booking control in the first mobile screen.
- Nothing escapes its container at 375 px.
- Every image looked at.
- One h1.
- Reduced motion respected.
- No invented reviews or numbers.

**Both:** you looked at the final output yourself, at the size the audience will see it.

## Project layout

```
<project>/
  STATUS.md  JOURNAL.md  credits.json  .env (keys: git-ignored)
  plan/        ideas, scripts, the voice timing (vo_words.json) and the anchors every scene and sound shares
  assets/      the inputs: images, voice takes, sound effects, fonts, vendor libraries
  src/         the video composition (index.html, engine.js, scenes/)  |  site/  the website
  cache/       anything that can be rebuilt: frames, stills, scores
  out/         what leaves the building: numbered cuts, phone copies, contact sheets
```

Setup, tools and keys: `references/setup.md`. Run `bash scripts/check_setup.sh` at the start of a session.

## Never

- Ship a frame, section or image you have not looked at.
- Copy another creator's script, shots, characters or voice, or use a copyrighted character.
- Invent a number, result, review or client.
- Let a key reach a terminal, a commit, a journal or a chat message. Check which key names are set, never their values.
- Batch-produce a series before the first piece is approved.
- Put an em dash in on-screen text or captions. It reads as AI-written; use a period, comma or colon.
