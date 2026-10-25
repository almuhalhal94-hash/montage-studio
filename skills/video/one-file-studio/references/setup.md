# Setup

Run `bash scripts/check_setup.sh` in the project folder. It checks each item below and prints what to install.

## Required

| Tool | Why | Install (macOS shown; Linux and Windows equivalents work) |
|---|---|---|
| Node 18+ (22+ preferred: built-in WebSocket) | Frame renderer, 3D readback | `brew install node` or nodejs.org |
| Python 3.10+ | Voice scoring, assembly, mix, QA | python.org |
| ffmpeg + ffprobe | Audio/video processing, loudness | `brew install ffmpeg` |
| Chrome headless shell | Fast deterministic frame renderer | `npx playwright install chromium-headless-shell` |
| Chrome for Testing | WebGL for 3D layers (readback) | `npx playwright install chromium` |
| faster-whisper | Word timings, take scoring | `pip install faster-whisper` (model `distil-large-v3` downloads on first use) |
| numpy, scipy, soundfile, librosa, Pillow | Audio and image math | `pip install numpy scipy soundfile librosa pillow` |

The renderer finds Chrome in Playwright's cache automatically. Set `CHROME=/path/to/binary` (and `CHROME_GL=` for the
WebGL one) to override.

## Keys (`<project>/.env`, never committed, never printed)

```
# Talal's copy: no key needed for voice or effects (tts_free.py + sfx_synth.py). pip install edge-tts
ELEVENLABS_API_KEY=      # optional, original method only
HIGGSFIELD or OPENAI or GOOGLE key (optional)  # image generation, whichever you use
PEXELS_API_KEY=          # optional licensed stock
PIXABAY_API_KEY=         # optional licensed stock
```

Load them with `set -a; . ./.env; set +a`. Add `.env` to `.gitignore`. When checking keys, report only which names
are filled, never the values.

## Optional

| Tool | Use |
|---|---|
| A browser-control tool or MCP (the user's own Chrome, a built-in browser, or the Playwright MCP) | Pinterest sourcing, website QA, Instagram references |
| Demucs | Split a reference video's voice, music and effects for a teardown |
| An image-generation MCP (e.g. Higgsfield) | Branded photoreal mockups, before/after pairs, green-screen props |
| An image-to-video model (e.g. Kling 3.0 or Seedance on Higgsfield) | Photoreal footage in motion: `references/video-ai-footage.md` |
| GSAP (`assets/vendor/gsap.min.js`) and three.js (`assets/vendor/three.min.js`) | Download once per project from their official CDNs or npm |

## Costs to expect (a 45 s ad)

| Item | Cost |
|---|---|
| Voice | ~1.5-2.5k ElevenLabs characters (auditions + 3 takes per line) |
| Effects | ~20 generations |
| Images | ~10-15 generations at 2K/4K (a few credits each on most hubs) |
| Rendering | Free and local: ~1 minute for 1,300 frames on a laptop |
| AI footage (only if used) | The haunted house: 6 key frames + 6 four-second Kling clips, about 59 Higgsfield credits |
