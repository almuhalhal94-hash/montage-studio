# Sound design and mix

The voice leads. Effects make every movement physical. Beds give places a temperature. Music is never used (house rule: see SKILL.md).

## 1. Effects made to order

> **Talal's copy: free effects.** Use `scripts/sfx_synth.py plan/sfx.json`: effects synthesized in code, offline, never
> musical. Kinds: whoosh, swish, click, tick, pop, thud, boom, impact, riser, heartbeat, typing, sparkle, glitch, paper, room.
> Example: `[{"name": "whoosh_in", "kind": "whoosh", "seconds": 0.6, "pan": -0.4}, {"name": "tap", "kind": "click"}]`.
> Natural or place sounds (wind, rain, door, birds, crowd) come from Pixabay (pixabay.com/sound-effects, free, no
> attribution): the user downloads them into `assets/sfx/<name>.mp3` and they are listed with `"kind": "file"`.
> The ElevenLabs method below is the original, for reference only.

Generate effects with ElevenLabs sound generation (`scripts/sfx_gen.py sfx.json`). One line per effect:

```json
[{"name": "sizzle", "text": "Close-up sizzle of steak hitting a hot charcoal grill, crisp crackling", "seconds": 1.6},
 {"name": "block_clack", "text": "A single small wooden toy block dropping onto a wooden table, light clack", "seconds": 0.5}]
```

- `seconds` must be **≥ 0.5**. Shorter returns HTTP 400. Trim in the mix.
- Describe the source, the action and the character: "short", "punchy", "close", "cinematic", "cute".
- Check every file has content with `ffmpeg -af volumedetect`. Regenerate near-silent results.

A starter library that covered two full ads:

| Group | Effects |
|---|---|
| UI | bloop, ui_click, enter_clack, follow_click, typing_fast, typing_soft, dm_ding, ding_soft, success |
| Movement | whoosh (left-right), whip, swipe, card_swish, zoom_transition, paper_swish |
| Impacts | boom (sub), impact_deep, impact_soft, camera_hit, hit_tick, board_thud, stamp |
| Magic | sparkle, shimmer_swell, riser, magic_wand, zap |
| Fire | ignite, flame_burst, fire_roar, fire_sweep, sizzle |
| Character | land_bonk, boing, hop, surprise, block_clack, card_flip, cash_stamp |
| Retro | rewind (VHS), glitch_short (keep under 0.3 s: long glitches are ear-piercing) |
| Beds (10 s, loopable) | night ambience, charcoal crackle, room tone |

## 2. The cue sheet

`scripts/mix.py mix.json` reads:
- the anchors from `plan/anchors.json`, the same `A.K` the picture uses
- the words from `plan/vo_words.json`
- a cue list: `[time, effect, peak dBFS, max seconds, pan]`

Times are expressions of anchors (`"K.flare + .02"`, `"word:built:5 - .08"`), so a re-timed video re-times its sound.

**Rules of thumb:**
- **A sound on every cut, open, close, click and land.** About 100-130 cues for a 45 s ad is normal.
- **Peaks** (before mastering):

  | Kind | Peak |
  |---|---|
  | Hero impacts, landings, the payoff | -9 to -12 dBFS |
  | Transitions | -13 to -18 |
  | UI | -17 to -22 |
  | Texture (sparkles, zaps, typing) | -22 to -27 |
- **Pan** lateral moves (a card sliding in from the left starts left). Stagger repeated sounds ±0.3 pan so they don't
  stack in the center.
- **Typing sounds** run for exactly the typing window. Whispered lines get fewer effects around them.
- **Beds** play under photo scenes only, at about -33 dB RMS, with 0.35 s fades. Ambience is not music.

## 3. Levels you can check without ears

Measure 400 ms windows of the mix:

| Measure | Target |
|---|---|
| Speech windows (median) | about -17 dBFS |
| Effects between lines | peaks clearly audible, -18 dBFS or louder at the hero moments |
| Integrated loudness (master) | -14 LUFS |
| True peak (master) | ≤ -1.5 dBTP |

Each line's level should sit within ±1.5 dB of the others, except intentional whispers (-2 to -3 dB).

`mix.py` writes `premaster.wav`, then masters it: gain to -14 LUFS, then an `alimiter` loop that lowers the ceiling
until the true peak is ≤ -1.5 dBTP.

## 4. Background bed (only when asked; no music)

- Only a voice-only Islamic bed: a nasheed with no instruments and no rhythmic percussion, or soft dhikr, from the user's own files or ones he approves. Never Quran recitation under an ad.
- Sit it 10-14 dB under the voice, with sidechain ducking under speech; every word must stay clear (run `qa.py --script`).
- Cut picture on the words and the moves, not on a beat. No drops, no stingers.
- Effects stay non-musical: no melodies, no tonal jingles, no drum hits in a pattern.
