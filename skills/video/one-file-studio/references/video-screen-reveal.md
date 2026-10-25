# Screen reveal: "this could be your business… on the big screen"

A finished ad fills the frame, then the camera pulls back and it is playing on a giant screen (a stadium jumbotron, a
Times Square billboard, a phone in someone's hand). Zero video credits: two stills and the composition engine.

## 1. Plates with a green screen (2 stills)
Generate (or shoot) the location with the screen showing **pure flat chroma green (#00FF00), no text**:
- a **wide plate** (the whole stadium, the board small and centered), and
- a **close plate** made from the wide one as an image reference ("same stadium, telephoto on the board, the board fills ~70% of the width").
No logos, no team or league names. One still is low-res for a deep zoom, so the close plate carries the first half of the move.

## 2. Find the screen and key it
- Mask = green dominance (`g - max(r, b) > 70`), then keep the **largest connected component** (green phone screens in the crowd will otherwise steal a corner).
- The 4 corners are the extremes of `x + y` and `x - y` over that component (works for any near-rectangle, slight perspective included).
- Key only that screen (alpha 0 inside, a soft edge from the green dominance, despill the rim) and save `plate_*_key.png`.
- Store the quads in `plan/plates.json`.

## 3. Composition
- Layer order: blurred copy of the ad (fills the screen's sides when the screen is wider than 16:9) → the ad → the keyed plates → a screen-colored glow (screen blend) → confetti / camera flashes → text.
- The ad is a plain 1920x1080 box. Every frame, map it into the 16:9 rectangle inside the screen quad with `A.quad(1920, 1080, quad)`
  (bilinear inset: `u0 = (1 - h·16/9 / w) / 2`).
- **Start** with the close plate at scale `1920 / ad_width_on_screen`, centered on the screen: the ad fills the frame exactly, so the cut into the reveal is invisible.
- **Pull back** in log space (`s = a·(b/a)^u`, ease in-out) to about 1.6 (most of the close plate).
- **Hand off** to the wide plate at the scale where its screen is the same size and position as the close plate's, cross-fade over 0.28 s, then keep pulling back to the wide plate's cover scale.
- Remove any letterbox bars just before the pull, so the screen shows the full frame.

## 4. Sound
A rising whoosh into a sub impact on the first frame of the pull, the crowd roar on top, a stadium bed under the rest, camera-shutter pops panned across. No music (house rule): let the whoosh and impact carry the pull.

Worked example: the VYRA "Big Screen" ad (studio project `big-screen/`): photoreal product stills from a code-designed can, the
pull-back, and the end card over the stadium.
