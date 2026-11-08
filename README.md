# rxbow — portfolio

A one-screen personal portfolio for **rxbow** (also known as **ro161012**): a
Minecraft skin holding a crossbow, standing on white paper, with Apple-style
liquid glass panels floating over it for the links. Display type is Monocraft,
the open Minecraft-style face; body copy is Instrument Sans.

Live effects come from [`@ybouane/liquidglass`](https://github.com/ybouane/liquidglass)
— real WebGL refraction, chromatic aberration, bevel rim and drop shadow, not a
`backdrop-filter` imitation. Design direction follows the
[`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) checklist
(SVG icons only, visible focus states, reduced-motion support, 375/768/1024/1440 breakpoints).

## Run it

No build step, no package manager — plain HTML, CSS and one ES module. The glass
library is vendored in `vendor/liquidglass/` (see [Vendored glass library](#vendored-glass-library)).

```bash
npx serve .          # or: python -m http.server 8000
```

Open the printed URL. Google Fonts need network access on first paint; if the glass
module fails to initialise the page automatically falls back to a CSS frost.

## Links wired up

| Panel | Destination |
| --- | --- |
| TikTok | https://www.tiktok.com/@rxbowed |
| Discord | `ro161012` — click to copy (button, not a dead profile URL) |
| Steam | https://steamcommunity.com/profiles/76561199251152385/ |
| Email | rohansijaria@gmail.com |

## Files

```
index.html    markup — #stage is the glass root, every .glass element is a direct child
styles.css    layout + typography + CSS fallback
main.js       boots LiquidGlass, Discord copy handler
assets/       skin-body.png (posed render), skin-face.png (avatar + favicon), skin-texture.png (raw 64×64)
assets/fonts  Monocraft.ttf + OFL.txt (SIL Open Font License 1.1)
assets/cape.png  the cape texture from white.png (kept for reference, not drawn by the page)
vendor/       liquidglass dist (patched once, see NOTICE.md)
```

## Vendored glass library

`vendor/liquidglass/liquidglass.js` is `@ybouane/liquidglass@1.0.3` with a single
change to `createImage()`: it resolves on `load` instead of awaiting
`img.decode()`. Upstream's `decode()` never settles on the font-embedded SVG data
URLs the library builds, which left `LiquidGlass.init()` pending forever — the
panels had canvases but were never painted. Details and diff in
[`vendor/liquidglass/NOTICE.md`](vendor/liquidglass/NOTICE.md).

Tune the panels live from the console with the debug handle:

```js
rxbowGlass.fps                        // current frame rate
rxbowGlass.markChanged()              // force a full re-render
```

## Updating the skin

The render is committed locally so the glass shader never touches a tainted canvas.

```
UUID: e7ae0f55-4c6d-4610-a81a-e4c6250b1aa2   (ign: rxbow)
```

The render is a posed 3D shot with a loaded crossbow held up, from the
[mc-api](https://mc-api.bisai.dev/docs) v2 renderer (no key needed). Regenerate with:

```bash
UUID=e7ae0f554c6d4610a81ae4c6250b1aa2
curl -o assets/skin-body.png \
  "https://mc-api.bisai.dev/v1/render/3d/fullbody/$UUID?v=2&transparent=1&width=1024&height=2048\
&mainhand=crossbow&rightArm=-82,0,8&leftArm=-74,0,-6&head=-6,0,0&camera=30,8,0"
# avatar: composited from the head pixels of assets/skin-texture.png
```

The API frames the figure small in a 1024×2048 canvas — the committed asset is
cropped tightly and centred on the character's body axis (481×546) rather than on
the transparent bounding box, so the body sits on the page centre while the
crossbow overhangs to one side. `camera=yaw,pitch,roll,distance` sets the view
angle; `mainhand` takes any item id, and `template=archer`, `offhand=shield`,
`playerRot=…` change the stance. Only the standby crossbow model renders —
`crossbow_charged`, `crossbow_pulling_1/2` and `crossbow_loaded` are silently
dropped, so the loaded read comes from the raised aiming pose.

## Glass tuning

Each panel reads its own shader settings from a `data-config` JSON attribute, e.g.
`{"cornerRadius":24,"refraction":0.60,"blurAmount":0.12}`. Full option list is in the
[library README](https://github.com/ybouane/liquidglass#available-options). Keep
`cornerRadius` in `data-config` in sync with the CSS `border-radius` so the rim lines
up with the focus outline.

Two structural rules from the library that this page depends on:

- the root (`#stage`) background is never sampled — the white wash lives in a sibling
  `.scene` element;
- a glass panel's own content is rasterised into its texture, so text inside a panel
  updates on DOM mutation (the Discord label swap relies on this).

## Deploy

Any static host works. For GitHub Pages: Settings → Pages → deploy from branch →
`main` / root, then the site is served at `https://ro161012.github.io/website/`.

## Credits

- Display typeface: [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan (SIL OFL 1.1)
- Liquid glass shader: [ybouane/liquidglass](https://github.com/ybouane/liquidglass) (MIT)
- Design guidance: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT)
- Skin render: [mc-api](https://mc-api.bisai.dev/docs) 3D render of the Minecraft account `rxbow` (texture from Mojang), posed with a crossbow

## The 3D hero (`hero3d.js`)

The hero is a live model, not a picture: drag it and you can see the character
from every side, `←`/`→` spin it from the keyboard, and an idle drift takes over
again a few seconds after you let go.

Everything below is vendored, so nothing depends on a CDN at runtime:

```
vendor/three/three.min.js              three.js r156 (UMD global THREE)
vendor/skinview3d/skinview3d.bundle.js skinview3d 3.4.2 (needs the THREE global)
```

They are injected on demand by `hero3d.js`, after the page has loaded. If either
fails — or WebGL is unavailable — the module throws, `main.js` puts `no-3d` on
`#stage`, and the pre-rendered `assets/skin-body.png` stays visible. Until the
first frame lands the PNG is the fallback, so the hero is never blank.

The cape is **not** skinview3d's cape: that one is a rigid plane. `buildCape()`
builds a 6x12 grid mapped to the cape pixels at (1,1)-(10,16) of the texture and
runs each row through a damped spring, so it trails when you spin the model and
settles afterwards. Drag velocity feeds the springs; the hem is clamped so a
flick cannot turn it into a sail. `prefers-reduced-motion` drops the wind to a
third and disables the idle spin, but dragging still works.

The crossbow is box geometry (stock, grip, limbs, drawn string, loaded bolt)
attached to the measured right-arm grip position — skinview3d has no item
support, and mc-api only renders the standby crossbow model, so the loaded look
is built rather than fetched.

## Making the glass read as liquid

Three things do the work, and all three matter:

1. **Colour behind it, not white** — `.scene` paints drifting blobs, a dot grid
   and an oversized wordmark. The library rasterises that layer at init and
   again whenever a panel moves or resizes (its render loop is gated on a dirty
   flag, not run against a live DOM every frame), so what the shader bends is
   colour and letterforms instead of flat white. Refraction is only legible if
   there is something with edges and contrast to bend.
2. **Refraction without haze** — the pills run `refraction` 0.86 and the nav
   0.84, while `blurAmount` drops to 0.14 / 0.12: real glass bends its
   surroundings but does not fog them. `chromAberration` 0.06 splits colour at
   the rim, and `distortion` 0.7 adds the micro-noise that stops the surface
   looking like idealised plastic.
3. **Edge response** — `edgeHighlight` 0.30, `specular` 0.70 and `fresnel` 0.94,
   so the rim brightens as the panel turns away and the highlight travels.
   `saturation` 0.14 keeps the colour behind the glass alive instead of
   greying it out, which is the usual tell of a CSS backdrop-filter fake.

## Two glass engines

`glass.js` is the default. It treats each panel's rounded bezel as a convex
lens, rasterises the displacement field into the red/green channels of a PNG and
feeds that to `backdrop-filter: url(#lg-…)`. The compositor evaluates the filter
against the *live* backdrop every frame, so the 3D hero and the drifting blobs
keep bending inside the panels while they move. Technique after kube.io's
"Liquid Glass in the Browser" and `mkj0kjay/vue-web-liquid-glass`. Knobs sit at
the top of the file: `BEZEL` (bevel depth), `STRENGTH` (peak displacement, px)
and `BLUR`. One map is built per `width x height x radius`, so the four dock
pills share a single filter and it is rebuilt on resize.

`vendor/liquidglass` is the fallback, used when `CSS.supports('backdrop-filter',
'url(#f)')` is false — Safari and Firefox do not ship SVG filters as
`backdrop-filter`. That path rasterises the scene and re-shoots only on a dirty
mark, so its panels see a frozen backdrop, and the `data-config` values in
`index.html` only matter there.

Both paths finish with `#stage[data-glass="on"]`; `has-svg-glass` marks the fast
one, which also gets a hairline border and a CSS drop shadow, since there is no
shader to draw them.

## Interface surfaces

Every surface is glass: the nav, the four dock pills and the toast. The toast
lives inside `#stage` for exactly that reason — a direct child carrying `.glass`
is all the library asks for. `border-radius` in CSS has to match `cornerRadius`
in the panel's `data-config` (28 nav, 26 pills, 18 toast) or the shader's rim and
the DOM box disagree at the corners.

The highlight that follows the pointer is a `::after` layer driven by `--mx` /
`--my`. It cannot come from the shader: the shader lights the surface from two
fixed directions, and its backdrop is only re-shot on a dirty mark. So it is
painted instead, at `z-index:-1` — above the injected canvas (also -1, earlier in
`tree order) and below the panel's own text. The library observes only
`data-config`, so writing those custom properties never costs a re-capture, and
`prefers-reduced-motion` skips the tracking altogether.

One accent (`--accent`, teal) is used only where something is interactive: the
focus ring and the icon on hover. Everything else stays ink-on-white.

Tune live from the console: `rxbowGlass.markChanged()` repaints after you edit a
panel's `data-config` in the DOM; `rxbowHero` is the 3D viewer handle.
