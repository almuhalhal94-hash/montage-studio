# Ideas, survey, scripts

## 1. Teardown a reference (if there is one)

**Find the cuts, then the words.** Detect every cut with ffmpeg's scene score
(`ffmpeg -i ref.mp4 -vf "select='gt(scene,0.25)',showinfo" -f null -`) and grab one still just after each cut, plus
the first frame. Transcribe the voice with word timings (faster-whisper). Lay the stills under the transcript, so every
shot sits next to what is being said. Where the sound matters, listen through the levels: loudness per 100 ms shows
where the hits and drops are.

Then write `plan/teardown.md` with:
- a shot table: time, picture, words on screen, voice line, tone, transition, sound events
- the arc in one line per beat (hook, problem, turn, proof, reveal, CTA, urgency, end card)
- what makes it work: the 3-5 devices that carry it
- what you will NOT reuse: words, shots, characters, brand. Copy the arc and the pacing, never the content.

## 2. Fifteen ideas

Write 15 genuinely different ideas: different promise, different visual world, different structure. Not 15 hooks for
one idea. One line each: the hook, what the viewer sees, why they would act.

Formats that work for "comment a keyword to get it" pieces:

| Format | Shape | Example |
|---|---|---|
| Made-by-Claude meta ad | A polished piece, then the reveal that one prompt built it, then the keyword | "What if you could make ads like this without touching an editor?" |
| Brand from one sentence | Blank to full brand, ending on a before/after wipe | "This taco truck had no name. So I gave Claude one sentence." |
| Before / after | Old work vs new work, stacked 9:16 | "Same Claude. These were my videos four days ago." |
| The list | 5 tools or steps, numbered slams, a skeptic character | "5 tools that make your sites look designer-made" |
| Movie trailer for a small business | Epic voice, tiny subject | "In a city of a million tacos..." |
| Napkin to product | A sketch becomes a live site or app | |
| Flash-forward | The payoff first, a rewind, then the story | |

## 3. The survey (pick with numbers, not taste)

Score each idea 1-10.

**Five viewer personas.** Define them for the audience; the panel score is their average. For a local-business
audience:
- an owner in the target niche
- an owner in a different trade
- a side-hustler who wants to sell the service
- a creator / marketer
- a casual scroller

Each persona answers: "would I stop scrolling AND do the CTA?"

**Four director checks:**

| Check | Question |
|---|---|
| Show | How much does it let the craft blow people away? |
| New | How different is it from the user's last piece? |
| Build | Can we make it at the quality bar with the tools we have? |
| Clean | No invented numbers or claims we can't back? |

**Weights:** panel 50 %, Show 20 %, New 15 %, Build 10 %, Clean 5 %.

Write the full table in `plan/ideas.md`. The winner is the top score. Borrow the runner-up's best device if it fits.

## 4. Ten scripts and the cross-check

Write 10 versions of the winner. Change the hook, the arc and the reveal; keep the core. Then cross-check each one,
0-2 per column:

| Column | Question |
|---|---|
| Hook | A pattern break in the first 2 s, seen and heard |
| Arc | An emotional turn: want, then payoff |
| Clear | Does a first-time viewer get it with the sound off? |
| Ask | A clear reason to comment, framed as "for your business" or "for you" |
| Fit | Lands at the target length with room for the visuals |
| Clean | No invented time, money or result claims |
| New | Doesn't repeat the user's previous video |
| End | Leaves room for the CTA and the end card or character |

Pick the top total and merge the best parts of the next two. Write the final as a table: time, line, tone tag, picture.

## 5. Script rules

- **Length.** Story ads: about 80-150 words for 40-55 s. List pieces: 40-70 words for 15-30 s.
- **Each line carries one thought**, in as few words as it can. Fragments are fine ("No designer. No camera. No timeline.").
- **Tone tag per line** (ElevenLabs v3): `[curious]`, `[deadpan]`, `[casually]`, `[mischievously]`, `[excited]`,
  `[building excitement]`, `[amazed]`, `[gasps]`, `[sighs]`, `[whispers]`, `[warmly]`, `[playfully]`, `[urgently]`,
  `[seriously]`, `[confidently]`, `[intrigued]`.
- **CAPS** on the one stressed word ("the ENTIRE brand").
- **Ellipses** for a beat ("So I gave Claude... one sentence.").
- **Numbers in words** ("first fifty", not "50").
- **Second line hands over.** If a hook is replaced, the new hook must hand into the next line naturally
  ("This entire ad? Claude made it." → "No designer. No camera. No timeline.").

**The CTA pattern that converts:**
1. "Want it [for your business]?"
2. "Follow me, and comment KEYWORD."
3. "I'll send it to your DMs."
4. Optional urgency: "The first fifty get it free. After that, it's paid." Only if you will honor it.

**Honesty:**
- Hype words are fine ("insane", "blew my mind").
- Numbers, results, prices, time claims and client counts must be true and checkable.
- "Every frame came from one prompt" is a claim. Make it true, or phrase it so it is.
