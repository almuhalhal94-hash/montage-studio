# Example: "Brand from one sentence" (44.5 s, 16:9)

A taco truck with no name gets a whole brand from one sentence typed to Claude: a logo drawn on construction lines, a
palette, a menu, cups, bags, a website on a phone, and finally the truck, revealed with a burning-line wipe. Then "every
piece of this came from one prompt", the CTA and a 3D character with the first-50 urgency gag.

Files here are the real configs from that video:

| File | Use with |
|---|---|
| `lines.json` | `python3 scripts/tts_takes.py examples/brand-reveal/lines.json` (9 lines, a tone tag on each, 3 takes) |
| `vo.json` | `python3 scripts/vo_assemble.py examples/brand-reveal/vo.json`: picks, picture gaps, pause caps, tempo |
| `sfx.json` | `python3 scripts/sfx_gen.py examples/brand-reveal/sfx.json` (17 effects + 2 beds) |

## The shot list

| Time | Line (tone) | Picture |
|---|---|---|
| 0.0 | (none) | Cold open: the finished truck at dusk, sizzle + boom, embers. A VHS rewind back to the blank truck |
| 1.3 | "This taco truck... had no name. No logo. Nothing." (curious, sigh) | A dashed selection box, an `untitled_truck.jpg` chip, a BRAND CHECK card of "none" rows |
| 6.7 | "So I gave Claude... one sentence." (mischievous) | A composer types the sentence. Send, then a dive into the final period |
| 10.3 | "And it built the ENTIRE brand!" (excited) | The period becomes an ember. Construction circles and pen handles, the mark fills, the wordmark lands |
| 13.5 | "A logo. Colors that feel like fire! A menu. Cups. Bags. A website." | One cut per word: logo triptych, palette flood, menu tilt, cup whip, bag iris, phone with a live site |
| 19.9 | (none) | Three hits on the beat: tacos, apron, A-frame sign |
| 21.6 | "Even the TRUCK." (gasp) | The burning-line wipe from blank to wrapped |
| 24.5 | "Every piece of this... came from one prompt." (whisper) | Pull back into a board of every asset; wires to the one prompt card |
| 28.7 | "Even this video." (whisper) | The board shrinks into an editor: code writing itself, a render counter |
| 30.8 | CTA (warm, playful) | Profile card (Follow → Following ✓), PROMPT typed and posted, the DM drops in |
| 36.9 | "The first fifty get it free. After that... it's paid." (urgent, serious) | The 3D character drops in, blocks rain into "50", FREE flips to PAID |
| 40.2 | (none) | End card: the character lands on the "Comment PROMPT" button and waves |

**The images:**
- Every photo was generated with the logo as a reference: a blank truck, then the same frame edited into the wrapped
  truck, plus the cup, bag, apron, cap, tacos and sign.
- The phone has a green screen, keyed with `key_green.py`.
- Pinterest gave the direction: dark + orange brand mockups, night food-truck photography.
