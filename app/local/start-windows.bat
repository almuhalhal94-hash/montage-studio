@echo off
chcp 65001 >nul
cd /d "%~dp0"
where ffmpeg >nul 2>nul || (echo ffmpeg غير مثبت. ثبته مرة وحدة بالأمر: winget install ffmpeg & echo.)
where python >nul 2>nul && (python server.py %*) || (py server.py %*)
pause
