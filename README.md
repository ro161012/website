# rxbow — portfolio

Portfolio for **rxbow** (aka `ro161012`), rebuilt as a Vue 3 + Vite app on the
liquid-glass engine from
[mkj0kjay/vue-web-liquid-glass](https://github.com/mkj0kjay/vue-web-liquid-glass):
CSS + SVG displacement maps, no WebGL, no canvas rasteriser.

## What the glass is

Each panel is treated as a physical lens. The maths in `src/lib/` comes straight
from that project:

- `surfaceEquations.ts` — the bezel profiles (convex squircle, convex circle,
  concave, lip) as height functions `h(x)`.
- `displacementMap.ts` — traces a vertical ray through the bezel with Snell's law
  at `n = 1.5`, accumulates how far it lands from where it entered, and
  rasterises that field into the red/green channels of a PNG (`128` = no
  displacement). Also handles non-circular shapes: corners, edges, squircle
  exponents.
- `specular.ts` — a rim-light map: the surface normal dotted against a fixed
  light direction, so the bevel catches light as it turns away.

`src/components/Filter.vue` wires those maps into one SVG filter — blur →
displacement → saturation → specular composite — and `GlassPanel.vue` measures
the panel, keeps the filter sized to it, and points `backdrop-filter` at it:

```css
backdrop-filter: url(#lg-xxxxxx) saturate(1.12);
```

Because the compositor evaluates a backdrop filter against the **live** backdrop,
the 3D hero, its cape and the drifting scene blobs keep bending inside the panels
as they move. The earlier WebGL path could not do that: it rasterised the scene
into a texture and only re-shot it on a dirty mark.

Chromium is the only engine that ships SVG filters as `backdrop-filter`
(it is not in the CSS spec). Elsewhere `GlassPanel` falls back to
`blur(16px) saturate(1.35)`, which keeps the surface readable but drops the
refraction.

Filters are generated in the browser at the panel's exact size, cached per
component, and rebuilt on resize (debounced by `Filter.vue`). The specular map is
baked for one light angle, so the highlight that follows the cursor is a painted
`::after` layer driven by `--mx` / `--my`.

## The rest of the site

- `src/lib/hero3d.js` — the character viewer: vendored three.js r156 +
  skinview3d 3.4.2 from `public/vendor/`, drag to orbit, arrow keys to spin, and
  a cape built as a 6×12 cloth grid on damped springs over `assets/cape.png`
  (skinview3d's own cape is a rigid plane). `HeroFigure.vue` wraps it and keeps
  the pre-rendered `skin-body.png` as the fallback.
- `src/components/LinkPill.vue` — one dock link on a `GlassPanel`.
- `src/components/GradientBlur.vue`, `src/components/LiquidGlassContainer.vue` —
  also ported from the reference project and available for containers that want
  stacked edge blur.
- `src/style.css` — layout, the scene backdrop (blobs, dot grid, oversized
  wordmark for the glass to bend), and the surface styling. Tailwind 4 is loaded
  because the ported components use its utilities.

## Scripts

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # → dist/
npm run preview
```

`base` is `./` in `vite.config.ts`, so a build works from a subpath such as a
GitHub Pages project site. `.github/workflows/deploy.yml` builds and publishes
`dist` to Pages on every push to `main`; the repository's Pages source must be
set to **GitHub Actions** for it to take effect.

## Credits

- Liquid glass maths, filter component and gradient-blur container:
  [mkj0kjay/vue-web-liquid-glass](https://github.com/mkj0kjay/vue-web-liquid-glass)
  (MIT), which in turn follows
  [Liquid Glass in the Browser: Refraction with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/)
  by kube.io.
- Monocraft typeface (OFL 1.1), skin placeholder and the cape are the owner's own
  assets; `public/assets/fonts/OFL.txt` carries the font licence.
