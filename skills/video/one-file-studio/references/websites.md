# Websites that look like the ones on Instagram

The bar: someone opens the site on a phone in front of the owner and the room goes quiet. A clean, correct, fast page
is the floor, not the goal. The goal is a site that feels made for this one business.

## 0. Cast yourself (put this at the top of your own plan)

> You are an elegant, award-winning website designer who takes criticism of every single detail. This site is for
> <business>, for <audience>, and its one job is <call / book / order / quote>.

## 1. Research (truth first, then taste)

**The business, verified:**
- name, phone, address, hours, services, prices, licenses, real reviews and real photos
- from primary sources (their own pages, Google profile, state license records)
- confirm identity by phone number: same-name businesses are everywhere
- for names, dates and team facts, read the raw HTML. AI page summaries invent people and years.

**Their existing brand:**
- logo, colors, signage, the truck, uniforms, menus, flyers, social posts
- before deciding a business has "no assets", look at what they own: the mark on the apron is a logo
- **anchor to it hard.** Sites built from the client's real world win. Invented concepts get rejected.

**References, Pinterest-first:**
- 6-10 strong references: `"<trade> website design"`, `"<style> landing page"`, `"<trade> branding"` on Pinterest,
  plus award galleries and Instagram posts the user likes
- note the devices, not the colors: a sale-bill poster hero, catalog plates, a letterboard menu

## 2. Three directions, shown cheaply

1. Write three directions in one paragraph each: palette (4-6 named hexes), 2-3 fonts, hero model, signature
   interaction.
2. Build each as a single hero screenshot or one styled section, not a site.
3. The user picks. **Never invent-and-ship an aesthetic.** "They'll love it when it's done" is how sites get called
   trash.

Two hero models. Pick one, never blend them:

| Model | When |
|---|---|
| A. **Photo-first**, the product as the headline | Strong product photos (plated food, finished jobs) |
| B. **Type-first**, giant display type with photos interleaved | Strong people or event photos, or few photos. Lettering can replace photography |

## 3. The system

| Element | Rule |
|---|---|
| Tokens | 4-6 named colors, 2-3 faces (display + text + optional mono) |
| Fonts | Don't reuse a display face or signature you used on your last site for a similar business |
| Signature interaction | **One**, built from the business's real facts. Each signature is spent once; never reuse one across sites |
| Motion budget | Scroll reveals with stagger, one pinned or scroll-driven device, hover/tilt on the hero media, grain, maybe a short preloader moment. All behind `prefers-reduced-motion`, with a 2.5 s force-reveal safety net |
| The call/book control | Part of the identity (a dock, a stamped tag, a live OPEN/CLOSED flag), never the same top-right button on every site |

Signature examples:
- a cup builder using the real sizes and prices
- a size-o-meter that reprices the page
- a polish-swatch picker that re-themes the site
- a heat filter that dims the menu
- a mileage odometer

**Vocabulary to draw from, not a checklist to complete:** cinematic media (video hero, duotone), scroll choreography
(pinned scrubs, clip-path reveals, grayscale-to-color), one signature interaction, distinctive display type, film grain,
microinteractions. Bolting every device onto one page is the template failure in a new costume.

## 4. Media

**Sources, in order:**
1. Client photos. Process photography (hands at work) is the highest value per dollar.
2. Licensed stock (Pexels, Pixabay, Mixkit video), credited.
3. Images generated from the Pinterest direction with their logo applied (`references/pinterest-and-images.md`).
4. Pinterest finds for direction only.

Never present stock or someone else's van or shop as theirs.

**Handling:**
- Download everything local; client CDNs die.
- Look at every image. Captions in briefs are often wrong (a "painting" that is a figurine, "products" that are
  flyers).
- Logo cleanup with PIL: knock out white backgrounds, crop a letterform favicon, make a 1200 × 630 og image from a
  real hero screenshot.
- **Scrims carve a legible zone; they never wash the whole photo.** Heavy overlays that bury the product are the most
  common amateur tell.

## 5. Build

**Stack:** static HTML/CSS/JS, no build step. It is fast, deploys anywhere and has nothing to break. GSAP only if the
signature needs it.

**Mobile first (390 px):**
- a `tel:` or booking control in the first screen, at least 44 px tall
- a sticky call control on mobile
- 0 of 9 top food sites did this. It is a free advantage.

**Sections**, ordered by the page's single job:
1. hero
2. proof (real reviews with names and source, or nothing)
3. offer, menu or services
4. the signature
5. about / process
6. FAQ (6 real questions)
7. a working form or booking
8. footer with hours, map link and license

**Trades:** a license / insurance trust bar from the state record; a form framed as an estimate request ("Request an
estimate"); real jobsite photos with before/after pairs. "Free" and "instant" only if the client confirms they are
true.

**Forms:** honeypot, consent line, thank-you state, delivery to the owner's inbox or phone. Test a real submission end
to end.

## 6. Structure for search (and AI answers)

- `<title>` 50-60 characters; meta description 140-160; one `<h1>`.
- Question-style h2s with answer-first paragraphs. JSON-LD (LocalBusiness / Restaurant / FoodEstablishment) with
  matching name, address and phone.
- `robots.txt`, `sitemap.xml`, canonical; `noindex` on previews.
- Schema is for clarity and AI visibility, not a ranking promise. The Google Business Profile and reviews move local
  rank more than any on-page trick.

## 7. Performance

- Measure the rendered image sizes at 390 and 1440 px (CDP or the browser). Serve width = rendered × 2, capped at
  natural.
- WebP only if it is ≥ 10 % smaller than the source at that width (hard-compressed JPEGs often aren't). Preload the
  hero file the page actually uses.
- Background covers in portrait boxes are sized from the box height too.
- Fonts: preload the stylesheet, `display=swap`, drop unused weights.
- No lazy-loading on demo galleries: screenshots and fast skimmers see blanks.

## 8. QA by script and by eye

Run `scripts/site_check.mjs <url-or-file>` at 375, 390 and 1440. It reports:
- **overflow measured against each `.wrap` container, not the viewport.** `body{overflow-x:hidden}` hides real
  overruns; an element can be inside the viewport and still break its column.
- broken images
- `tel:` count in the first mobile screen
- h1 count
- missing alts (decorative images with `alt=""` are fine)
- em dashes in text

**Validate the checker first.** Point it at a deliberately broken copy and confirm it fails, then at the fix and
confirm it passes. A detector that has never failed proves nothing.

**Eye pass:**
- Full-page screenshots after forcing reveals (`*{transition:none!important;animation:none!important}`, add the reveal
  classes, `loading=eager`, cache-bust the URL).
- Look at every section at phone size. Lighthouse mobile is the last number, not the first.
- `img{max-width:100%}` with width/height attributes needs `height:auto`, or photos stretch into strips.

## 9. Deploy and verify

- Netlify or Vercel. Verify the stable URL (not a deploy-hash URL) with your own eyes: load it, call the tel link, send
  the form.
- Grep the shipped files for em dashes, template leftovers ("Lorem", "SAMPLE", "555-" on a live site) and keys.

## Honesty on websites

- Reviews only if they are real and attributable ("via Google, Maria R."), or no review section.
- The client's own published claims ("since 2012") are theirs to make. Third-party facts (ratings, licenses) are
  verified.
- No response-time promises in your copy ("we reply in 60 seconds"). Only the wiring is instant.
