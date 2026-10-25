#!/usr/bin/env bash
# One File Studio: check the tools this skill needs. Prints OK / MISSING with the install line. Never prints key values.
ok() { printf "  \033[32mOK\033[0m       %s\n" "$1"; }
no() { printf "  \033[31mMISSING\033[0m  %s  ->  %s\n" "$1" "$2"; }
echo "One File Studio setup check"
if command -v node >/dev/null; then v=$(node -v | tr -d v | cut -d. -f1); [ "$v" -ge 22 ] && ok "node $(node -v)" || ok "node $(node -v) (22+ recommended for built-in WebSocket)"; else no node "https://nodejs.org or brew install node"; fi
command -v python3 >/dev/null && ok "$(python3 --version)" || no python3 "https://python.org"
command -v ffmpeg >/dev/null && ok "ffmpeg" || no ffmpeg "brew install ffmpeg / apt install ffmpeg"
command -v ffprobe >/dev/null && ok "ffprobe" || no ffprobe "comes with ffmpeg"
PW=""; for d in "$HOME/Library/Caches/ms-playwright" "$HOME/.cache/ms-playwright" "$HOME/AppData/Local/ms-playwright"; do [ -d "$d" ] && PW="$d"; done
if [ -n "$PW" ] && ls "$PW" | grep -q chromium_headless_shell; then ok "chrome headless shell (frames)"; else no "chrome headless shell" "npx playwright install chromium-headless-shell"; fi
if [ -n "$PW" ] && ls "$PW" | grep -qE '^chromium-[0-9]+$'; then ok "chrome for testing (3D / WebGL)"; else no "chrome for testing" "npx playwright install chromium"; fi
PY=${PYTHON:-python3}
$PY -c 'import edge_tts' 2>/dev/null && ok 'python: edge_tts (free voice)' || no 'python: edge_tts' 'pip install edge-tts'
for m in faster_whisper librosa soundfile scipy numpy PIL; do $PY -c "import $m" 2>/dev/null && ok "python: $m" || no "python: $m" "pip install faster-whisper librosa soundfile scipy numpy pillow"; done
if [ -f .env ]; then
  for k in ELEVENLABS_API_KEY PEXELS_API_KEY PIXABAY_API_KEY; do grep -qE "^$k=.+" .env && ok ".env $k (filled)" || printf "  --       .env %s (empty, optional unless you need it)\n" "$k"; done
  grep -qx '.env' .gitignore 2>/dev/null && ok ".env is git-ignored" || no ".env not in .gitignore" "echo .env >> .gitignore"
else printf "  --       no .env here yet (create it with ELEVENLABS_API_KEY=... and git-ignore it)\n"; fi
