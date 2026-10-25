# Changelog

## 1.0.9 (2026-10-12)

- **Hook check, first word:** faster-whisper now runs with VAD. Without it, any sound before the voice (a crowd, a riser) snapped
  word 1 to 0.00 s and hid a late first word. Readings can still land up to ~0.25 s early.
- **Hook openers (learned on 19 and 21):** keep an opener at 1.0 s or under so word 1 lands by 1.3 s; end opener whooshes before
  word 1 (one masked "Freelancers"); give the first second real sound, or QUIET_OPEN flags it.

## 1.0.8 (2026-10-12)

- **Deliver:** `scripts/deliver.py` runs every gate (QA, intelligibility, hook check), makes the phone copy and copies the master into the delivery folder only if everything passed.
- **Hook check:** `scripts/hook_check.py` scores the first 3 s of any video (frame-0 thumbnail, motion, cuts, first sound,
  first word) and exits 1 on a flag.
- **Numbers:** `scripts/textnorm.py` is the one normalizer for script vs transcript in `score_takes.py` and `qa.py`:
  "twenty-five hundred dollars" and "$2,500" now match.
- **Whisper threshold calibrated:** dry deadpan reads sit near 2, real whispers 0.2-1.2; WHISPERED now below 1.5.
- **Engine gotchas:** `references/video-engine.md` lists five render traps found tonight (gradient text per word, filters from
  "none", frame 0, negative positions, marker caps).

## 1.0.7 (2026-10-12)

- **Voice, v4 + v3:** `tts_takes.py` records every line on both ElevenLabs v4 and v3 (`"models"`), takes named `<id>_<m>t<k>`.
  v4 is far more expressive but sometimes whispers short lines; the scorer now picks per line by numbers.
- **Whisper detector:** `score_takes.py` adds `body` (low-voice energy over hiss) and rejects unwanted whispered takes.
- **Intelligibility QA:** `qa.py <mp4> --script plan/vo_words.json` transcribes every line of the final mix and flags any
  word the music buried (caught "skill" heard as "scale" under a crowd). Invented brand names pass on close spelling.
- **Screen reveal:** `references/video-screen-reveal.md`, the "your ad on the stadium jumbotron" pull-back from two green-screen plates.

## 1.0.6 (2026-10-11)

- **AI footage:** `references/video-ai-footage.md` covers photoreal key frames, image-to-video (Kling 3.0 / Seedance
  via Higgsfield), frame-locked sequences with remapped speed, scare craft for horror reels, and closing whisper pauses.
- **Worked example:** `examples/haunted-house/` is the complete 24 s haunted-house reel (jump scare open, three hooks):
  script, every image, clip and sound prompt exactly as used, the composition, the voice tightener and the mix.
  The imagery costs about 59 Higgsfield credits.

## 1.0.5 (2026-10-10)

- **Voice assembly:** silence hidden inside an aligner-stretched word is now capped too, and every line reports its
  longest remaining pause (about 0.4 s is the ceiling for dead air).

## 1.0.4 (2026-10-10)

- **Community:** questions and results now go to the AI account, @doingaiwitheli. The byline links there too.

## 1.0.3 (2026-10-10)

- **Live sites in motion:** `scripts/site_film.mjs` records a real site scrolling (GPU Chrome, real wheel events,
  compositor frames, constant 30 fps). Credit rules are in `references/video-engine.md`.
- **WebGL facts corrected.** The headless shell runs WebGL in software with SwiftShader flags. Full Chrome paints on
  the GPU once background throttling is off. `webgl_frames.mjs` now passes those flags.
- **Premium 3D materials:** glass only refracts opaque objects (use `alphaTest`); `toneMapped: false` for exact palette
  colors; gradient-equirect reflections; fitting the 9:16 frame; particle words; liquid forms.
- **Color and contrast:** complementary pairs weighted about 60-30-10, saturation for phone feeds, color as emotion, and backgrounds that
  never sit still (`references/quality-bar.md`).

## 1.0.2 (2026-10-10)

- **Footage inside scenes:** `A.clipPlayer` plays frame sequences of existing videos on a word-anchored schedule. A how-to
  for cutting clips and checking them is in `references/video-engine.md`.
- **Live sites on phones:** `scripts/capture_sites.mjs` makes full-page phone captures with reduced motion and lazy
  images loaded, for phone walls.
- **Two new scene patterns:** the before/after card (freeze, then a green wipe into the new work) and the phone wall.
- **Shell gotcha:** `ffmpeg -nostdin` inside `while read` loops.

## 1.0.1 (2026-10-10)

- **Records:** `STATUS.md`, `JOURNAL.md` and `credits.json`, with rights values `test-only` / `publishable`. Outputs go to `out/`.
- **Reference teardowns:** now cut-based. Scene-change detection gives one still per cut, laid under the word transcript.
- **Wording:** tightened in several guides.

## 1.0.0 (2026-10-10)

First release.

- **Video flow:**
  - 15-idea survey, 10 scripts + cross-check
  - Pinterest-first imagery with branded generation and before/after pairs
  - per-line expressive voice with scored takes (clipped-ending detection)
  - word-anchored code animation (15 scene patterns) and 3D characters through WebGL readback
  - sound on every move, mastering to -14 LUFS
  - QA, and hook variants without re-rendering
- **Website flow:**
  - verified research and brand anchoring, three directions before building
  - a signature interaction per site, mobile-first conversion, SEO-ready structure
  - container-based overflow QA with a validated checker
- **Scripts (15):**

  | Group | Scripts |
  |---|---|
  | Rendering | `render.mjs`, `webgl_frames.mjs` |
  | Voice | `tts_takes.py`, `score_takes.py`, `vo_assemble.py` |
  | Sound | `sfx_gen.py`, `mix.py` |
  | QA | `qa.py`, `contact_sheet.py`, `site_check.mjs` |
  | Images | `pinterest_extract.js`, `fetch_images.py`, `key_green.py` |
  | Setup | `get_vendor.sh`, `check_setup.sh` |
- **Templates:** a working video composition, a 3D character starter, website plumbing.
- **Examples:** the brand-reveal configs, and the made-by-Claude ad with its hook variants.
