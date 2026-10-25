#!/bin/bash
# تشغيل استوديو المونتاج على الماك — دبل كليك على هذا الملف
cd "$(dirname "$0")"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "⚠️  ffmpeg غير مثبت. ثبّته مرة وحدة بهذا الأمر ثم شغّل الملف من جديد:"
  echo "    brew install ffmpeg"
  echo "(إذا ما عندك Homebrew: https://brew.sh)"
fi
python3 server.py "$@"
