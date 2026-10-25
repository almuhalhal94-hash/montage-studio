# Pinterest-first images

Pinterest has the best supply of real-world photography and design direction: dusk food trucks, laptops in clouds,
brand-identity mockups, luxury interiors, night street scenes. Use it first for both direction and photos, then settle
the rights before anything is published.

## 1. Search

Write 3-6 specific queries per scene, not one vague one. Name the subject, the light, the mood and the format.

- Too vague: "food truck".
- Good:
  - "food truck at night neon photography"
  - "taco truck branding identity"
  - "restaurant brand identity mockup dark orange"
- For website direction: "<trade> website design awwwards", "<trade> landing page dark", "<style> hero section".

**Browser options**, best first:
1. **The user's own logged-in browser** through a browser-control tool. Pinterest shows full results when logged in.
2. **A built-in or Playwright browser.** It works logged out, but shows fewer results.

Navigate to `https://www.pinterest.com/search/pins/?q=<url-encoded query>`, wait about 3 s, and take a screenshot to
judge the board by eye.

## 2. Extract the originals

Run `scripts/pinterest_extract.js` in the page with the browser's JavaScript tool. It scrolls a little and returns a
JSON list of `{pin, alt, orig}`, where `orig` is the original-resolution URL (`i.pinimg.com/originals/...`).

Pick candidates by looking. Screenshot the grid and note which pins fit. Prefer images that are:
- **at least 2000 px on the long side** for full-frame use, and at least 1200 px for cards
- sharp at the subject, with real light and no watermarks
- free of baked-in text, unless you want a mockup
- composed with room for type when the image will be a background

## 3. Download, log, look

```bash
python3 scripts/fetch_images.py picks.json assets/images/pinterest --min 1600
```

The script downloads each `orig`, drops anything smaller than `--min` px on the long side, and adds each kept file
(local path, source pin, size, `"rights": "test-only"`) to `credits.json`.

**Then look at every image** (open it, or build a contact sheet). A caption, alt text or summary is not the image.
Faked transparent PNGs (a checkerboard baked into the pixels) are common: reject them.

## 4. Rights: decide before you publish

| Source | Can you publish it? |
|---|---|
| Client's own photos, or your own | Yes |
| Licensed stock (Pexels, Pixabay, Unsplash, CC0 / CC BY, credited) | Yes, logged in `credits.json` |
| Pinterest finds of other people's work | **No.** Direction, mood boards, unposted test cuts only |
| Images generated from the Pinterest direction, with the real logo applied | Yes, they are yours |

A test cut may use Pinterest photos to prove the edit. Before posting, swap each one for a client photo, a licensed
photo or a generated original.

## 5. Generate originals from the direction

Any strong image model works, e.g. Nano Banana or GPT Image (directly or through a hub like Higgsfield). The method:

1. **Write the prompt like a photographer's shot list.** Subject, angle, lens, light, time of day, place, mood, grain.
   Add "no text, no logos" for blanks.
   > "Cinematic night photograph of a plain, completely blank white step-van food truck at a Phoenix curb at blue hour,
   > three-quarter view, the long serving side fills the frame, warm sodium streetlight, palm silhouettes, 35mm at f/2,
   > fine film grain, photorealistic. No logos, no text."
2. **Brand application.** Upload the logo (a clean PNG on a solid background) as a reference image:
   > "printed with the attached logo exactly as given: the orange mark above the cream wordmark."
   Cups, bags, aprons, caps, signs, trays and truck wraps all come out photoreal with correct lettering most of the
   time. Check the spelling of every wordmark at full size.
3. **Before/after pairs.** Generate the blank scene first. Then edit that exact image with the logo as a second
   reference:
   > "Keep the camera angle, framing, lighting and background identical, pixel-aligned. Change only the truck: wrap it
   > in matte charcoal with the logo..."
   Measure the offset between the pair (a background-band match at reduced size) and shift by the measured pixels so a
   wipe between them is seamless.
4. **Screens for compositing.** Ask for "a phone held in hand, the screen a flat solid chroma-key green (#00FF00), no
   reflections".
   - Key it with `scripts/key_green.py`. It writes a foreground PNG with the screen cut out and prints the screen's four
     corners.
   - Place your website or UI behind it in the scene. The thumb overlapping the screen stays in front automatically.
5. **Resolution.** Generate at 2K for cards and 4K for anything the camera pushes into. Downscale everything to a
   working size (e.g. 2752 × 1536) for rendering speed.

Log each generated image in `credits.json`: model, prompt, reference ids, date, `"rights": "publishable"`.

## 6. Mapping images and UI onto photos

- **A screen in a photo (laptop, phone, billboard).** Find the four corners (fit lines to each edge of a keyed or
  flood-filled region, then intersect them). Map a DOM element onto them with a homography (`quad()` in
  `templates/video/engine.js`): a CSS `matrix3d`. Everything inside stays live: typing, scrolling, cursors.
- **A photo as a stage.** Put a large photo in a container sized to the photo's pixels and move a camera over it
  (`photoCam()`): scale for push-ins, translate for pans. The cover-fit factor is `1080 / photoHeight`.
- **Product mockups you build yourself.** Multiply-blend the logo onto a blank surface photo, and warp it with a
  homography. For curved surfaces (cups), slice the logo into vertical strips and scale each strip by the cosine of
  its angle.
