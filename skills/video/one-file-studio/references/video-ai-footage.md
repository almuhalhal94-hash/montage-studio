# AI footage: photoreal shots, animated, inside a code-built video

Use this when the video needs real-looking places, creatures or products in motion (a haunted house, a launch film, a
product ad) and drawing them in code would look cheap. Code still does the cut, the type, the UI, the timing and the
sound. Worked example: `examples/haunted-house/` (a 24 s horror reel with a jump scare, three hooks).

**What it costs.** It needs an image model and an image-to-video model; we use Higgsfield. The haunted house used
6 key frames (`gpt_image_2_5`, high, 2k, about 2.75 credits each) and 6 clips (Kling 3.0 Pro, 4 s, silent, 7 each):
about 59 credits. Tell the user the number before you generate.

## 1. Direction first, then key frames
1. Pinterest (or any references) for direction only: `references/pinterest-and-images.md`. Never feed someone else's
   photo into a generator.
2. Write one key-frame prompt per shot, like a cinematographer: subject, angle, lens, light, atmosphere, and what must
   be in frame. Generate at the final aspect ratio (9:16 for reels, 16:9 for laptop/YouTube).
3. Look at every frame. Regenerate anything with warped hands, extra limbs, garbled text or a busy area where your
   type will sit. Text inside a generated image is never trusted: put words in code.
4. Show the key frames to the user before animating. Animation is the expensive step.

## 2. Animate each key frame (image-to-video)
- Start image = the approved key frame. 4 s is plenty: you will use 1.5-3 s of it.
- The prompt names three things: the **camera** ("almost locked, a very slow push in", "slow dolly forward"), the
  **motion** (fog rolls, candles flicker, a figure steps out and rushes the lens), and what **stays still** ("keep the
  architecture stable, no morphing, no new objects, no text").
- For a scare, ask for speed and size: "lunges straight at the camera very fast, ending with the face filling the frame,
  violent handheld shake".
- If the tool recommends a preset instead of generating, decline it and send your prompt.
- Check the clip frame by frame (a strip at 2-3 fps). Things models do: doors that never open, a second figure appearing,
  faces that melt mid-turn. Keep the clean range; regenerate only if no range works.

## 3. Put the clips in the timeline
- Extract frame sequences: `ffmpeg -i shot.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -q:v 2 -start_number 0 shot/f%03d.jpg`.
- Map reel frames to clip frames with a remap (see `examples/haunted-house/src/scary.js`, `SEQ`): each shot has a reel
  range and a clip range. A clip range longer than the reel range plays fast (a 1.6 s lunge squeezed into 0.67 s is
  what makes a scare violent); equal ranges play at real speed.
- Camera life in code: a slow `scale` push per shot, a seeded shake (amplitude rising through the shot) for scares, a
  punch-in (scale 1.0 to 1.18) on the lunge.
- Overlays in code: light snow or dust on a canvas, a vignette, grain, captions, the hook band.

## 4. Scare craft (horror reels)
- **Open:** at most 0.4 s of black (a heartbeat under it), then the face slams in already mid-motion. Two white flash
  frames at the peak, then two frames of dead black and a silent beat before the hook. Sound: stinger + scream-whoosh +
  sub boom on the same frame the face appears.
- **Hook** immediately after, over the most beautiful shot (the house under the moon), as a big line on a dark band.
- **Second scare** around 10-11 s (a figure rushes the lens) keeps people past the middle. The heartbeat speeds up
  before it.
- **Twist** into the tool that made it (freeze the last frame, glitch, shrink it into the Claude Code window).
- **Loop bait:** in the last half second something opens its eyes in the dark.
- No gore. Generated people and creatures only; never a real person's likeness without their consent.

## 5. Voice with long pauses
Whispered and dramatic deliveries leave 1-2 s gaps. Close every silence longer than 0.3 s to about 0.16 s, then align
the words again (`examples/haunted-house/tighten_vo.py`; `scripts/vo_assemble.py` also caps pauses). A 14 s whisper
pitch became 9.3 s with no change in sound.

## 6. Check before you claim
Contact sheet of every hook version, the scare frame by frame, loudness (-14 LUFS, true peak about -2.4 before AAC so
the MP4 stays under -1.5), and the near-black list: only the black you planned (the open and the beats after scares).
