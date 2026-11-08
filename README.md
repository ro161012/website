# rxbow — portfolio

A one-screen personal portfolio for **rxbow** (also known as **ro161012**): a
Minecraft skin standing on white paper, with Apple-style liquid glass panels
floating over it for the links.

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
assets/       skin-body.png (full render), skin-face.png (avatar + favicon), skin-texture.png (raw 64×64)
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

To refresh after changing the skin in-game:

```bash
curl -L -o assets/skin-body.png "https://mc-heads.net/body/rxbow/512"
curl -L -o assets/skin-face.png "https://mc-heads.net/avatar/rxbow/256"
```

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

- Liquid glass shader: [ybouane/liquidglass](https://github.com/ybouane/liquidglass) (MIT)
- Design guidance: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT)
- Skin render: generated from the Minecraft account `rxbow` via mc-heads (texture from Mojang)
