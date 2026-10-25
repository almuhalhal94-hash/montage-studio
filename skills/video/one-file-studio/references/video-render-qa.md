# Render, QA, deliver, variants

## Render

```bash
# stills at the moments that matter (out of order is fine)
node scripts/render.mjs --page src/index.html --times 0.4,1.6,5.9,9.5,12.6 --out cache/stills --jpg
python3 scripts/contact_sheet.py cache/stills cache/sheet --cols 4

# anchors for the sound mix
node scripts/render.mjs --page src/index.html --dump plan/anchors.json

# everything
node scripts/render.mjs --page src/index.html --from 0 --to <dur> --fps 30 --out cache/frames --jpg --quality 93 --workers 4
```

- `--w/--h` set the frame size: 1920 × 1080 by default, 1080 × 1920 for vertical.
- With 4 workers, about 1,300 frames of 1080p render in about a minute.
- The renderer stops on any page error and prints it.

## Encode

```bash
ffmpeg -framerate 30 -i cache/frames/%05d.jpg -i assets/mix/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k -shortest out/<name>_v1.mp4
# phone copy for review and messaging
ffmpeg -i out/<name>_v1.mp4 -c:v libx264 -preset slow -crf 24 -maxrate 4M -bufsize 8M -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 192k out/<name>_v1_phone.mp4
```

## QA (`python3 scripts/qa.py <mp4>`)

It reports:
- streams, duration, loudness (target -14 LUFS) and true peak (≤ -1.5)
- near-black frames, so you can confirm they are deliberate dips
- identical consecutive frames: frozen frames or stalls
- contact sheets of the whole video

Then look at the hook frames, the CTA and every transition at full size.

**Delivery checklist:**
- [ ] The first frame works as a thumbnail; the first word lands by about 1.3 s.
- [ ] Every line ends cleanly; no echo under line 2.
- [ ] Captions are spelled as the script, readable at phone size, with no em dashes.
- [ ] The CTA keyword on screen matches the spoken one and the caption.
- [ ] The promised asset (prompt, file, guide) exists, and the keyword automation sends it.
- [ ] `STATUS.md`, `JOURNAL.md` and `credits.json` are current; the cut number has gone up.

## Shell gotcha

`ffmpeg` inside a `while read` loop reads the loop's input and eats the first characters of the next lines, so file
names come out wrong. Always pass `-nostdin` there.

## Variants without re-rendering (new hooks, reorders)

**A new hook:**
1. Render only the new opening (e.g. 83 frames).
2. Find the splice frame in the approved video: the first clean frame of the next scene (e.g. frame 134).
3. Join them:

   ```bash
   ffmpeg -framerate 30 -i cache/hook/%05d.jpg -i approved.mp4 -i mix_hook.wav -filter_complex \
    "[0:v]format=yuv420p,setsar=1[a];[1:v]trim=start_frame=134,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" \
    -map "[v]" -map 2:a ... out.mp4
   ```

4. Audio: place the new hook stem at 0 and the approved premaster from the same frame onward. Then master again.

**A reorder** (e.g. "start with the ad, then the setup"):
- Cut the approved video by frame numbers with `split` + `trim` + `concat`.
- Cut the premaster on the same frames, with **butt joins** and 12 ms fades. Crossfades shorten the audio and drift
  the sync.
- Choose seams where the motion matches. A laptop pulling back cuts cleanly to a laptop pulling back.

Give every variant its own name (`<name>_v3-hookB.mp4`) and its own phone copy, so they can be tested side by side.

## Hook check (the first 3 seconds)
`python3 scripts/hook_check.py renders/final/*.mp4` scores every opening: frame-0 detail (a blank or black first frame is a
thumbnail you can't use, and the feed preview starts there), motion in the first 0.5 s, cuts in the first 3 s, when the first
sound and the first word land (bar: 1.3 s), and the first second's loudness vs the whole. It exits 1 on any flag, so run it before
delivery. It caught two empty first frames on 10/12 that eyes had missed on a contact sheet (sheets start at 0.5 s).

## Deliver in one command
`python3 scripts/deliver.py renders/final/x.mp4 --to "<delivery folder>" --name "<number> TITLE - hook (len, comment X) - FOR REVIEW" --script plan/vo_words.json`
runs QA + intelligibility, the hook check and a phone copy, and copies the master into the delivery folder only if every gate passed
(`--force` when a flag is deliberate, e.g. a black open before a jump scare).
