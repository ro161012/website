# Vendored: @ybouane/liquidglass 1.0.3

Source: https://github.com/ybouane/liquidglass (npm: `@ybouane/liquidglass@1.0.3`)
License: MIT, © ybouane

`liquidglass.js` is the published `dist/index.js`, copied verbatim with **one**
change (line ~134, `createImage`):

```diff
-    img.onload = () => {
-      img.decode().then(() => {
-        requestAnimationFrame(() => resolve(img));
-      });
-    };
+    img.onload = () => requestAnimationFrame(() => resolve(img));
```

## Why

The library rasterises each panel by building an SVG `foreignObject` that
inlines the page's webfonts as base64 `url()` sources, then loads it through an
`Image`. `img.decode()` on that payload never settled in Chromium, so the
`onload` handler never reached `resolve()`, and `LiquidGlass.init()` never
resolved: the panels got their canvases but were never painted.

Loading the same payload through html-to-image 1.11 (which resolves on `load`
and does not await `decode()`) captured in ~40 ms, which is what this patch
restores. Everything else in the file is untouched.

## Refresh

To bump the library, re-download `dist/index.js`, re-apply the patch, and check
that the glass still initialises (`#stage[data-glass="on"]`).
