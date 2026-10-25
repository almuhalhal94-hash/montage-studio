#!/usr/bin/env python3
"""One File Studio: deliver a finished video in one command, so no check gets skipped.

Usage:  python3 scripts/deliver.py renders/final/name.mp4 --to "<folder>" --name "19 MY AD - hook (22s, comment X) - FOR REVIEW"
                [--script plan/vo_words.json] [--force]
Runs, in order:
  1. qa.py            loudness (-14 LUFS, true peak <= -1.5), near-black and frozen frames, contact sheets, and with --script
                      every line of the FINAL mix transcribed against the script (intelligibility)
  2. hook_check.py    frame 0, motion, cuts, first sound, first word
  3. a phone copy     (<name>_phone.mp4 next to the master, H.264 CRF 23, AAC 160k)
  4. the copy         into --to as "<name>.mp4", only if 1-2 passed (or --force)
Run it with the Python that has faster_whisper (word timing + intelligibility)."""
import sys, os, re, shutil, subprocess
here = os.path.dirname(os.path.abspath(__file__)); a = sys.argv[1:]
if not a or a[0].startswith('-'): sys.exit(__doc__)
V = a[0]; opt = lambda k: a[a.index(k) + 1] if k in a else None
dest, name, script, force = opt('--to'), opt('--name'), opt('--script'), '--force' in a
fails = []
def run(args):
    p = subprocess.run([sys.executable, *args], capture_output=True, text=True); return p.returncode, p.stdout + p.stderr
print('1/4 qa + intelligibility'); rc, out = run([f'{here}/qa.py', V] + (['--script', script] if script else []))
for l in out.splitlines():
    if re.search(r'loudness|near-black|identical|intelligibility|^\s{2}\S+\s+\d\.\d\d', l) and 'Warn' not in l: print('   ', l)
m = re.search(r'loudness (-?[\d.]+) LUFS \| true peak (-?[\d.]+)', out)
if not m or not (-15 <= float(m.group(1)) <= -13) or float(m.group(2)) > -1.5: fails.append('loudness')
nb = re.search(r'near-black frames \(luma < 8\): \[(.*?)\]', out)
if nb and nb.group(1).strip(): fails.append('near-black frames (check they are deliberate)')
fr = re.search(r'identical consecutive frames: (\d+)', out)
if fr and int(fr.group(1)) > 3: fails.append('frozen frames')
if script and 'intelligibility: OK' not in out: fails.append('intelligibility')
print('2/4 hook check'); rc2, out2 = run([f'{here}/hook_check.py', V])
for l in out2.splitlines()[-2:]:
    if 'Warn' not in l: print('   ', l)
if rc2: fails.append('hook check: ' + out2.strip().splitlines()[-1].split()[-1])
print('3/4 phone copy'); ph = re.sub(r'\.mp4$', '_phone.mp4', V)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-nostdin', '-i', V, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', ph], check=True)
print(f'    {ph} ({os.path.getsize(ph) / 1048576:.1f} MB)')
if fails and not force:
    print('\nNOT DELIVERED:', '; '.join(fails), '\nFix them, or pass --force if each one is deliberate.'); sys.exit(1)
if dest and name:
    os.makedirs(dest, exist_ok=True); target = os.path.join(dest, name + ('' if name.endswith('.mp4') else '.mp4')); shutil.copy2(V, target)
    print(f'4/4 delivered -> {target}' + (f'   (forced past: {"; ".join(fails)})' if fails else ''))
else: print('4/4 checks passed; pass --to and --name to copy it into the delivery folder')
