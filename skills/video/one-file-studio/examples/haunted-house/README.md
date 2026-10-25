> Talal's copy: this example uses a music-box melody bed. Do not copy that part; replace it with ambience or nothing.

# Example: the haunted house (24 s horror reel, jump scare open, three hooks)
Made with this skill + an image and image-to-video model (Higgsfield: 6 key frames at about 2.75 credits + 6 Kling clips
at 7 = about 59 credits) + ElevenLabs (voice, sound effects). Method: `references/video-ai-footage.md`.
- `plan/SCRIPT.md`: beats and timings. `plan/prompts.json`: every key-frame and clip prompt, exactly as used.
- `plan/sfx.json`: every generated sound (run `scripts/sfx_gen.py plan/sfx.json`).
- `tighten_vo.py`: closes whisper pauses; `make_data.py`: data per hook; `build_audio.py`: the mix (-14 LUFS).
- `src/scary.js` + `scary.css`: the scenes (frame-locked clips with remapped speed, shake, flashes, hook band, captions,
  the Claude Code twist, the pitch end card). It needs the template's `engine.js` and `boot.js` next to it, and the
  clips extracted to `assets/clips/house/<shot>/fNNN.jpg`.
- `haunted-house-preview.mp4`: the result (low-res preview).
The generated images, clips and voice files are not included (size); the prompts make new ones.
