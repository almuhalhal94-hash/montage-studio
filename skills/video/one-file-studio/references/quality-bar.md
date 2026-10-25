# The quality bar

These rules came from real rejections. Each "don't" is a version that got called cheap, slow, robotic or templated.

## What premium looks like

- **Photography carries the realism; code carries the motion.**
  - A laptop floating in real clouds, a real truck at dusk, a real kitchen: these read as expensive.
  - The same scenes drawn as shapes read as "illustration" and "template".
- **One stage, one light.** A dark or airy stage, one soft glow, glass UI cards, depth blur. Restraint beats effects.
  More effects on a weak idea makes it look more like a template, not less.
- **Kinetic type that breathes.**
  - Words blur in (blur 9 → 0, rise 14 px, about 0.5 s), one accent word in the brand color.
  - In calm, premium pieces, slam entrances under 0.4 s read as "snappy" in a bad way; 0.5-0.7 s reads as premium.
  - In high-energy pieces (thumbnail-style), quick slams are right for stamps and payoff words, never for every word.
- **A new transition on every beat.** Whip pan, iris, zoom-through, glow wipe, burning-line wipe, pull-back into a
  board. Never the same transition twice in a row.
- **Real UI, real moments.** Typing that types, a cursor that clicks, a Follow button that becomes "Following ✓", a
  comment that posts, a DM that arrives. Viewers trust what they recognize.
- **Depth.** Embers rising, a halftone ripple on Send, a camera that is always moving slightly (push 1.00 → 1.07 over
  a scene), film grain at 5-7 %, a soft vignette.

## Color and contrast

- **Complementary pairs pop:** colors opposite on the wheel (ultraviolet and yellow, blue and orange, red and cyan).
  Weight them about 60-30-10: most of the frame in the base color, a third in its complement, a sliver of a third
  hue for sparkle.
- **Saturation has to survive a phone in a feed.** Muted, "tasteful" palettes vanish at small sizes.
- **Type:** white with a hard dark outline and a drop shadow reads on anything. The key word goes in the secondary
  color.
- **Color carries the emotion.** Pain beats run cold and desaturated (slate, error red); the payoff is fully
  saturated. The switch between them is part of the payoff.
- **Backgrounds never sit still:** a drifting mesh gradient, particles, light streaks, rays. A static gradient reads
  as a template.
- When the creator asks for a new look, drop their usual brand colors entirely rather than mixing them in.

## Voice

- A **different tone on each line** is what holds attention:
  1. curious hook
  2. mischievous setup
  3. excited reveal
  4. gasp on the payoff
  5. whisper for the secret
  6. warm call to action
  7. urgent close
- A flat narrator loses viewers, even with great visuals.
- One request per line. A whole script in one request ignores most tone tags.
- An echo or reverb works on the **first line only**, then the voice goes dry and close.
- Write numbers the way people say them ("first fifty", "two hundred ninety-seven dollars"), never digits.
- Every take is checked for a clipped last word. A cut-off ending is the most common TTS defect and the easiest to
  miss.

## Sound

- **No music by default** on voiced ads. Sound effects carry it: a bloop when things open, a whoosh when cards move,
  clicks on clicks, a hit on every cut, a riser into reveals.
- **Never music** (house rule in SKILL.md). If the user wants a bed, only a voice-only Islamic bed, well under the voice.
- Effects must be audible. A common failure is effects mixed 15 dB under the voice that nobody hears.
  - Target speech at about -17 dBFS.
  - Effect peaks between -9 and -20 dBFS.
  - A short gap between lines is fine; dead air between scenes is not.

## Pacing

- **Hook in the first 1.3 s.** The first frame is the thumbnail: make it the most striking image in the video (a
  flash-forward of the payoff works).
- Story ads run 40-55 s; list and loop pieces run 15-30 s. Trim internal pauses inside a line (keep 0.3-0.45 s), not
  the delivery itself.
- Give text at least 1 s per 3 words on screen.

## Words on screen

- Captions are word-synced, bottom third, about 44 px at 1080p, bold, one keyword colored per line.
- On a busy or light shot, put text on a dark glass band; never white text on a white UI.
- No em dashes on screen. Spoken emphasis in CAPS is shown in normal case.

## What failed (don't repeat)

| Failure | Fix |
|---|---|
| Shapes drawn in code as the "photos" | Real or generated photography |
| Templates built at speed | One idea, crafted, approved first |
| A robotic voice, stitched per beat with odd pacing | Per-line v3 takes, scored, assembled with natural gaps |
| Effects too quiet to hear | Measured levels, effects peaking -9 to -20 dBFS |
| Same transition everywhere | A new transition per beat |
| Raw AI video clips as the hero | Code-built motion around stills; AI video only as texture |
| A batch of 19 videos overnight with no approved first piece | One piece, approved, then the next |
| A whisper tag that never whispered | Measure voiced share, take the most whispered take |
| A take that cut off the last word | Tail-silence check on every take |
| Black flashes from a filter animated from "none" | Animate from explicit start values |
