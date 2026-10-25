#!/usr/bin/env python3
"""الخادم المحلي لاستوديو المونتاج.

يشغّل الموقع على جهازك ويضيف:
  - تصدير احترافي عبر ffmpeg (H.264 بجودة عالية + صوت مضبوط على -14 LUFS)
  - كابشن تلقائي بتوقيت الكلمة عبر faster-whisper (اختياري)

التشغيل:
  python3 server.py            # على هذا الجهاز فقط
  python3 server.py --lan      # يفتح للجوال على نفس الواي فاي
"""
import argparse
import json
import mimetypes
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import uuid
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

APP_DIR = Path(__file__).resolve().parent.parent
EXPORT_DIR = Path(os.environ.get('MONTAGE_EXPORT_DIR', Path.home() / 'Montage Studio'))
WHISPER_MODEL = os.environ.get('MONTAGE_WHISPER_MODEL', 'small')
WHISPER_LANG = os.environ.get('MONTAGE_WHISPER_LANG', 'ar') or None
FFMPEG = shutil.which('ffmpeg')
JOBS = {}
JOBS_LOCK = threading.Lock()
_whisper = {'model': None, 'lock': threading.Lock()}

mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('application/javascript', '.js')


def has_whisper():
    try:
        import importlib.util
        return importlib.util.find_spec('faster_whisper') is not None
    except Exception:
        return False


def safe_name(name):
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '', name or '').strip() or 'montage'
    return name[:80]


def loudnorm(src, dst):
    """تطبيع صوتي بمرحلتين إلى -14 LUFS (معيار انستقرام ويوتيوب)."""
    probe = subprocess.run(
        [FFMPEG, '-hide_banner', '-nostats', '-i', str(src), '-af',
         'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'],
        capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', probe.stderr, re.S)
    stats = json.loads(m.group(0)) if m else None
    if not stats or stats.get('input_i') in ('-inf', None) or float(stats['input_i']) < -70:
        shutil.copy(src, dst)
        return
    af = ('loudnorm=I=-14:TP=-1.0:LRA=11:linear=true:'
          f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
          f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
          f"offset={stats['target_offset']}")
    subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src), '-af', af,
                    '-ar', '48000', str(dst)], check=True)


class Job:
    def __init__(self, w, h, fps, frames, name):
        self.id = uuid.uuid4().hex[:12]
        self.dir = Path(tempfile.mkdtemp(prefix='montage_'))
        self.w, self.h, self.fps, self.frames, self.name = w, h, fps, frames, safe_name(name)
        self.proc = None
        self.out = self.dir / 'out.mp4'
        self.log = open(self.dir / 'ffmpeg.log', 'wb')
        self.received = 0
        self.created = time.time()

    def start(self, wav_bytes):
        raw = self.dir / 'mix.wav'
        raw.write_bytes(wav_bytes)
        norm = self.dir / 'mix_norm.wav'
        loudnorm(raw, norm)
        cmd = [
            FFMPEG, '-y', '-hide_banner', '-loglevel', 'error',
            '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', str(self.fps), '-i', '-',
            '-i', str(norm),
            '-map', '0:v', '-map', '1:a',
            '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
            '-r', str(self.fps),
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', 'apad',
            '-shortest', '-movflags', '+faststart', str(self.out),
        ]
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=self.log)

    def feed(self, body):
        i = 0
        n = len(body)
        while i + 4 <= n:
            size = struct.unpack_from('<I', body, i)[0]
            i += 4
            self.proc.stdin.write(body[i:i + size])
            i += size
            self.received += 1

    def finish(self):
        self.proc.stdin.close()
        code = self.proc.wait()
        self.log.close()
        if code != 0 or not self.out.exists():
            err = (self.dir / 'ffmpeg.log').read_text(errors='ignore')[-600:]
            raise RuntimeError('ffmpeg: ' + err)
        EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime('%Y-%m-%d_%H-%M')
        final = EXPORT_DIR / f'{self.name}_{stamp}.mp4'
        shutil.copy(self.out, final)
        return final

    def cancel(self):
        try:
            if self.proc and self.proc.poll() is None:
                self.proc.kill()
        except Exception:
            pass
        shutil.rmtree(self.dir, ignore_errors=True)


def transcribe_file(path):
    from faster_whisper import WhisperModel
    with _whisper['lock']:
        if _whisper['model'] is None:
            print(f'⏳ تحميل نموذج Whisper ({WHISPER_MODEL}) لأول مرة…', flush=True)
            _whisper['model'] = WhisperModel(WHISPER_MODEL, device='auto', compute_type='int8')
        model = _whisper['model']
        segments, info = model.transcribe(str(path), language=WHISPER_LANG, word_timestamps=True,
                                          vad_filter=True, beam_size=5)
        words = []
        for seg in segments:
            for w in (seg.words or []):
                text = w.word.strip()
                if not text:
                    continue
                for part in text.split():
                    words.append({'w': part, 's': round(w.start, 3), 'e': round(w.end, 3)})
        return {'ok': True, 'language': info.language, 'words': words}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else '') and '/frames' not in (args[0] if args else ''):
            sys.stderr.write('  ' + (fmt % args) + '\n')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        chunks = []
        while n > 0:
            c = self.rfile.read(min(n, 1 << 20))
            if not c:
                break
            chunks.append(c)
            n -= len(c)
        return b''.join(chunks)

    def job(self, jid):
        with JOBS_LOCK:
            return JOBS.get(jid)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/health':
            return self.json({'ok': True, 'ffmpeg': bool(FFMPEG), 'whisper': has_whisper(),
                              'exportDir': str(EXPORT_DIR)})
        m = re.match(r'^/api/job/(\w+)/result$', path)
        if m:
            j = self.job(m.group(1))
            if not j or not j.out.exists():
                return self.json({'ok': False, 'error': 'not found'}, 404)
            data = j.out.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            with JOBS_LOCK:
                JOBS.pop(j.id, None)
            threading.Timer(5, lambda: shutil.rmtree(j.dir, ignore_errors=True)).start()
            return
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        path = url.path
        try:
            if path == '/api/job':
                if not FFMPEG:
                    return self.json({'ok': False, 'error': 'ffmpeg غير مثبت على الجهاز'}, 500)
                cfg = json.loads(self.body() or b'{}')
                j = Job(int(cfg['w']), int(cfg['h']), int(cfg.get('fps', 30)), int(cfg.get('frames', 0)), cfg.get('name'))
                with JOBS_LOCK:
                    JOBS[j.id] = j
                return self.json({'ok': True, 'id': j.id})
            m = re.match(r'^/api/job/(\w+)/(audio|frames|finish|cancel)$', path)
            if m:
                j = self.job(m.group(1))
                if not j:
                    return self.json({'ok': False, 'error': 'المهمة غير موجودة'}, 404)
                action = m.group(2)
                if action == 'audio':
                    j.start(self.body())
                    return self.json({'ok': True})
                if action == 'frames':
                    j.feed(self.body())
                    return self.json({'ok': True, 'received': j.received})
                if action == 'finish':
                    final = j.finish()
                    print(f'✅ تم التصدير: {final}', flush=True)
                    return self.json({'ok': True, 'path': str(final)})
                if action == 'cancel':
                    j.cancel()
                    with JOBS_LOCK:
                        JOBS.pop(j.id, None)
                    return self.json({'ok': True})
            if path == '/api/transcribe':
                if not has_whisper():
                    return self.json({'ok': False, 'error': 'ثبّت faster-whisper أولاً: pip install faster-whisper'}, 500)
                name = parse_qs(url.query).get('name', ['audio'])[0]
                suffix = Path(name).suffix or '.bin'
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                    f.write(self.body())
                    tmp = f.name
                try:
                    return self.json(transcribe_file(tmp))
                finally:
                    os.unlink(tmp)
            return self.json({'ok': False, 'error': 'unknown endpoint'}, 404)
        except (BrokenPipeError, ConnectionResetError):
            return self.json({'ok': False, 'error': 'توقف ffmpeg أثناء الاستقبال'}, 500)
        except Exception as e:  # نرجع الخطأ للواجهة بدل ما يطيح الخادم
            print('❌', repr(e), flush=True)
            return self.json({'ok': False, 'error': str(e)}, 500)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser(description='الخادم المحلي لاستوديو المونتاج')
    ap.add_argument('--port', type=int, default=8790)
    ap.add_argument('--lan', action='store_true', help='افتح للجوال على نفس الشبكة')
    ap.add_argument('--no-browser', action='store_true')
    a = ap.parse_args()
    host = '0.0.0.0' if a.lan else '127.0.0.1'
    srv = ThreadingHTTPServer((host, a.port), partial(Handler, directory=str(APP_DIR)))
    url = f'http://localhost:{a.port}/'
    print('\n🎬 استوديو المونتاج — الخادم المحلي')
    print(f'   افتح: {url}')
    if a.lan:
        print(f'   من الجوال (نفس الواي فاي): http://{lan_ip()}:{a.port}/')
        print('   ⚠️ لا تشغّل وضع --lan على شبكة عامة')
    print(f"   ffmpeg: {'✓' if FFMPEG else '✗ غير مثبت — التصدير الاحترافي لن يعمل'}")
    print(f"   Whisper: {'✓' if has_whisper() else '— غير مثبت (اختياري: pip install faster-whisper)'}")
    print(f'   الفيديوهات تُحفظ في: {EXPORT_DIR}')
    print('   للإيقاف: Ctrl+C\n', flush=True)
    if not a.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nتم الإيقاف.')


if __name__ == '__main__':
    main()
