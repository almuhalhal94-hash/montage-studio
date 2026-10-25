# 3D characters and objects

Use three.js for characters, objects, particles and 3D type. Two facts about headless Chrome shape the pipeline:

1. **Chrome's fast headless shell runs WebGL only in software.** Launch it with `--enable-unsafe-swiftshader
   --use-angle=swiftshader`. It works, but heavy scenes are slow, and many WebGL sites refuse it ("browser not
   supported").
2. **Full Chrome for Testing (`--headless=new`) uses the real GPU, but only paints with three flags:**
   `--disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows`.
   Without them `requestAnimationFrame` never fires and screenshots hang. Rendering into a canvas and reading it back
   with `canvas.toDataURL()` works either way.

So 3D is pre-rendered as a transparent PNG sequence, then played as a layer in the main video:

```bash
node scripts/webgl_frames.mjs --page src/three/scene.html --from 34.3 --to 42.6 --fps 30 --out cache/three
```

- The page defines `window.renderAt(t)`: it poses the scene for `t`, calls `renderer.render()` and returns
  `canvas.toDataURL('image/png')`.
- Create the renderer with `preserveDrawingBuffer: true` and `alpha: true`, and clear to transparent.
- In the main page, a drawer sets `#seq.src` to the frame for `t` and returns `img.decode()`. The renderer waits for
  it.

## Materials and scenes that read premium

- **Glass refracts only opaque objects.** Type or shapes meant to show through a transmissive material must be opaque:
  give their material `alphaTest: .5`, not `transparent: true`, or the glass only shows the backdrop.
- **Keep palette colors exact:** set `toneMapped: false` on backdrops and type. Filmic tone mapping washes saturated
  colors out.
- **Reflections:** build the environment with `PMREMGenerator.fromEquirectangular()` from a smooth gradient canvas
  (bands of the palette plus a white key). Hard-edged softbox planes make glass look blocky.
- **Fit the vertical frame first.** Visible width at distance d = 2·d·tan(hfov/2), where tan(hfov/2) =
  tan(vfov/2) × aspect. At 9:16 the frame is much narrower than it feels.
- **Particle words:** sample canvas text into points and ease them in from a swirl. Additive blending keeps its color
  on near-black backgrounds and washes to white on bright ones.
- **Liquid forms:** simplex noise on an icosahedron (detail 64-96) on the CPU, then `computeVertexNormals()`. It's
  deterministic and fast enough per frame.

## Characters that look premium

- **Soft vinyl-toy blocks, not voxel walls.** Build a character from a few large rounded boxes: an extruded
  rounded-rectangle shape with bevel. Eyes are dark rounded slits set into the front face, and lids are thin boxes that
  scale down over them to blink. Hundreds of 1-unit cubes read as a tiled wall.
- **No tone mapping, exact colors.** `renderer.toneMapping = THREE.NoToneMapping`, sRGB output, and a
  MeshStandardMaterial at roughness about 0.5 in the brand color. ACES tone mapping washes saturated brand colors out
  to pastel.
- **Light recipe:**

  | Light | Color | Intensity | Position |
  |---|---|---|---|
  | Hemisphere | warm sky / dark ground | 0.7 | |
  | Key (directional, with soft shadows) | | 1.4 | above-left-front |
  | Rim | orange | 1.1 | behind-right |
  | Fill | | 0.3 | |

  Shadows: PCF soft shadows, a 2048 map, and a `ShadowMaterial` ground plane at opacity 0.4 so only the shadow
  composites.
- **Personality comes from timing:**
  - a drop with gravity (y = h(1 − u²))
  - a landing squash (scale y 0.75, x and z 1.15, recovering with a damped cosine)
  - a little dust ring
  - blinks at irregular moments
  - hops with squash on the land
  - a turn of the head toward whatever it reacts to
  - an arm wave on the end card
- **Props in the same world:** blocks that fall into a dot-matrix number (5 × 7 glyphs, a bounce easing, stagger by
  row), a card with canvas-texture faces that flips 180° (FREE → PAID), an exclamation mark that pops on surprise.

## Landing on a DOM element

To make a character stand on a button that lives in the HTML layer, convert the button's screen position to world
space:

```js
const onScreen = (sx, sy) => { const v = new THREE.Vector3(sx / 960 - 1, 1 - sy / 540, .5).unproject(cam).sub(cam.position).normalize();
  return cam.position.clone().add(v.multiplyScalar(-cam.position.z / v.z)); };   // point on the z = 0 plane
```

Aim slightly below the button's top edge so the feet overlap it, and move the shadow plane to that height. Delay the
DOM elements the character crosses (avatar, handle) until it has landed.

## Rights

Never build a copyrighted character (cartoon families, studio mascots) or a sound-alike voice. A company's mascot
(e.g. an AI product's critter) is fine as a short fan cameo, never as your recurring host, and never in a way that
implies a partnership. Design your own characters: a glossy map pin with eyes, a block buddy, a chat bubble with eyes.
