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

The render is a posed 3D shot with a crossbow in the main hand, from the
[mc-api](https://mc-api.bisai.dev/docs) v2 renderer (no key needed). Regenerate with:

```bash
UUID=e7ae0f554c6d4610a81ae4c6250b1aa2
curl -o assets/skin-body.png \
  "https://mc-api.bisai.dev/v1/render/3d/fullbody/$UUID?v=2&mainhand=crossbow&transparent=1&width=1024&height=2048"
curl -L -o assets/skin-face.png "https://mc-heads.net/avatar/rxbow/256"
```

The API frames the figure small in a 1024×2048 canvas — the committed asset is
cropped to its transparent bounding box (344×534) so the hero is not mostly
empty pixels. Swap `mainhand` for any item id, or add `template=archer`,
`offhand=shield`, `playerRot=…` to change the pose.

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
