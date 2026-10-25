# Voice: expressive AI narration

> **Talal's copy: free voice, no ElevenLabs.** Use `scripts/tts_free.py` (Microsoft Edge neural voices, free, no key).
> - Main narrator: **Fahed, `ar-KW-FahedNeural`** (Kuwaiti male). Dialogue: give every line a `speaker`; the default second
>   voice is **Hamed, `ar-SA-HamedNeural`** (Saudi male, clearest contrast). Other options: `ar-AE-HamdanNeural`,
>   `ar-QA-MoazNeural`, `ar-BH-AliNeural` (too close to Fahed); female `ar-BH-LailaNeural`, `ar-KW-NouraNeural`.
> - In a dialogue, keep the two voices apart (never lower a voice's pitch: it muddies the words; change the voice instead), and leave 0.25-0.4 s
>   between speakers in `vo.json`.
> - No [tone tags] (ignored). Emotion comes from punctuation ("..." for a pause, "!" for energy, "؟" for a question) and
>   from per-line `rate` / `pitch`. Write in clear Arabic with key harakat on words the voice may misread.
> - Takes are `<id>_e1..e3`; pick them in `vo.json` the same way (e.g. `"hook": "e2"`). Scoring and QA run in Arabic
>   (`OFS_LANG=ar` is the default; whisper model `large-v3-turbo`).
> - If the user records his own voice, skip TTS: put each line as `assets/vo/takes/<id>_e1.mp3`, write `takes.json`, then score.
> Everything below about ElevenLabs v3/v4 is the original method, kept for reference only.


Built on ElevenLabs **v4 (`eleven_v4`) and v3 (`eleven_v3`)**, recorded side by side. The pipeline: audition → per-line takes
on both models → score → assemble → process. Your ears are numbers; every choice here is measured.

**v4 vs v3 (measured 10/12 on the same lines):** v4 is far more expressive (pitch movement 4.0-7.1 semitones vs 0.8-1.6 on v3)
and ends lines cleanly, but on some voices it **whispers short lines** even without a whisper tag (a CTA like "Want it? Comment
skill. It's free." came out breathy three takes in a row). v4 takes only `stability` and `similarity_boost`; pacing comes from
punctuation and tags. So: record every line on both, let the scorer reject unwanted whispers, and pick by numbers.

## 1. Pick the voice (audition, 5 minutes)

1. Generate the hook plus one whisper line in 3-4 candidate voices.
2. Score them with `scripts/score_takes.py`. The useful column is `pitch`: the semitone standard deviation, i.e.
   expressiveness. Above 6 is lively; under 4 is flat.
3. Give the user the auditions as one MP3 (`ffmpeg ... concat`). The user's ear decides; your numbers shortlist.

Picks that worked:
- **Story ads:** a relaxed, natural male narrator.
- **Brand pieces:** an enthusiastic social-media female voice.
- **An "ad inside the ad":** a second, accented, energetic voice for contrast.

## 2. Takes: one request per line

`scripts/tts_takes.py lines.json` reads:

```json
{"voice_id": "...", "takes": 3, "models": ["eleven_v4", "eleven_v3"], "stability": 0.45, "style": 0.3, "speed": 1.0,
 "lines": [{"id": "hook", "text": "[curious] This taco truck... had no name. [pause] No logo. [sighs] Nothing."}, ...]}
```

It writes `assets/vo/takes/<id>_<m>t<k>.mp3` (m = v4 / v3) and `takes.json`. Pick a take in `vo.json` by its suffix, e.g. `"hook": "v4t2"`.

- **One request per line.** In a whole-script read, most tags get ignored; a whisper comes out voiced.
- **On v3 the script appends ` [short pause]` to every line.** v3 sometimes stops the audio on the last syllable. The pause
  gives the ending room. v4 doesn't need it.
- **Numbers:** write them as words in the script ("twenty-five hundred dollars"). The scorer and QA normalize both sides
  (`scripts/textnorm.py`), so "$2,500" in the transcript matches. `vo_assemble` aligns word by word, so on a number phrase its
  `match` reads low: check that line's word times by eye.
- **Brand names:** spell made-up names phonetically ("VYRA" → "Vai-rah") and check the transcript; the scorer's `match` drops when the model reads it another way.
- **`stability: 0`** ("creative") gives the widest emotion. Use 0.5 for steadier lines. Make 3 takes per line.
- **`speed`:** 1.0-1.1. Faster delivery is done later with a pitch-preserving tempo change, per line.
- **Output** `mp3_44100_128` works on every plan; 192 kbps needs a higher tier.

## 3. Score every take

```bash
python3 scripts/score_takes.py assets/vo/takes/takes.json
```

Per take it reports:

| Column | What it measures |
|---|---|
| `match` | Script vs transcript (faster-whisper). Below 1.0 means a missed, extra or mispronounced word: "Claude" read as "Clod" shows up here. |
| `tail` | Seconds of quiet after the last sound. Below 0.12 s means the take was cut off mid-word. **Reject it.** |
| `pitch` | Expressiveness, in semitones. |
| `swing` | Loudness range between words, in dB. Dynamic reads sound human. |
| `voiced` | Share of voiced frames. A real whisper is low (0.3-0.5). If a "whisper" take reads 0.9, it didn't whisper. |
| `body` | Low-voice energy (80-400 Hz) over hiss (above 2 kHz). Spoken lines read 2-12 (a dry deadpan read sits near 2), a real whisper 0.2-1.2. Below 1.5 the take is flagged WHISPERED and rejected unless the line asks for a whisper. `voiced` alone misreads short lines; this doesn't. |
| `speech` | Seconds from the first word to the last. |

**Choose:** `match` = 1, `tail` ≥ 0.12 and not WHISPERED (unless asked), then the highest `pitch` and `swing`. Whisper lines: the lowest `voiced`.
After the final mix, run `qa.py <mp4> --script plan/vo_words.json`: it transcribes every line of the finished audio and flags any word the music or crowd buried (it caught "skill" heard as "scale" under a stadium roar).
Ties go to the shorter take.

## 4. Assemble

`scripts/vo_assemble.py config.json` builds the narration track and the timing file every scene reads. The config:

```json
{"takes": "assets/vo/takes/takes.json", "order": ["hook", "gave", "built"],
 "pick": {"hook": "t3"}, "gap_before": {"hook": 1.25, "gave": 0.45}, "cap": {"hook": 0.4},
 "tempo": {"gave": 1.08}, "gain": {"reveal": -2}, "level": -19}
```

What it does to each line:
1. Forces the script's words onto the transcript timings (sequence alignment), so captions show your spelling and
   punctuation.
2. Cuts at the real end of the sound: 30 ms of sustained energy, ignoring the file's last 80 ms where encoders leave a
   click. Never cut at the transcript's word end, which runs early.
3. Shortens long silences inside a line to `cap` seconds, including silence the aligner hid inside a stretched word.
   It cuts only quiet runs, so sighs and breaths stay. Each line reports its longest remaining pause; about 0.4 s is
   the ceiling for dead air in a read.
4. Applies `tempo` (pitch-preserving, 1.04-1.08) to tighten slow reads without losing emotion.
5. Normalizes speech to `level` dBFS, with optional per-line `gain` (whispers -2 dB).

**Gaps are picture time.** Leave room for typing, a logo build, montage hits or a payoff hold.

Outputs: `assets/vo/narration.wav`, `plan/vo_words.json` (every word with start and end) and `plan/vo_lines.json`.

## 5. Process

The chain (ffmpeg): high-pass 80 Hz, -2 dB at 280 Hz, +2 dB at 3.2 kHz, a high shelf +2 dB at 9.5 kHz, a de-esser,
and compression at 3:1 from -21 dB. For whispers, add +4.5 dB of air at 8 kHz on those lines only (crossfaded).

Echo goes on the **first line only**. Use a synthetic stereo IR (RT60 about 2.2 s) on a send that closes after the
line's last word, and fade the tail out within about 0.35 s so it never rings under the next line. All of this is in
`scripts/mix.py` (`voice_fx`).

## 6. Captions from the words

Every word in `vo_words.json` becomes a caption word that appears 0.1 s before it is spoken. Show CAPS emphasis in
normal case and color one keyword per line. The engine's `caption(line, {hl: [i]})` does this.

## 7. Re-hooking an existing video

Record the new hook line in the same voice and settings. Score it, assemble it alone with the first-line echo, and
splice it onto the approved video (`references/video-render-qa.md` → Variants). The rest of the voice stays
untouched.
