# rxbow

Personal page for **rxbow** (aka `ro161012`), built on the layout of
[qdran.de](https://www.qdran.de/) with a Berserk-manga treatment: a black-and-white
Berserk wallpaper — a moonlit field, Guts on horseback — as the backdrop,
drifting under screentone, grain and a slow light sweep.

Plain HTML, CSS and one ES module — Vite is only the dev server and bundler.

## What lives where

- `index.html` — the page: clock, wordmark, tagline, the three social rows.
- `public/berserk-panel.webp` — the backdrop: the Berserk wallpaper at 1920 ×
  1080, kept as the original black-and-white art.
- `src/style.css` — tokens, the background stack (`panel` image → tone,
  screentone and grain → sheen → ash → vignette), the row list, responsive
  rules and the reduced-motion fallbacks.
- `src/main.js` — four small pieces:
  - the clock in the top right, local time with seconds plus the timezone label;
  - the ash canvas: depth-randomised grey motes drifting upward with a
    per-particle sway, capped at 2× DPR, paused when the tab is hidden and
    rendered as a single static frame when the OS asks for reduced motion;
  - the panel parallax: a smoothed pointer offset so the page reads as a
    surface in front of the viewer (skipped under reduced motion);
  - the Discord row copies `ro161012` on click and confirms with a toast,
    with no hint text cluttering the row.
- `favicon.svg` — the wallpaper's moon over the field as a two-shape mark,
  white on black, drawn so it still reads at 16px in a tab.

## Links

TikTok `@rxbowed` · Discord `ro161012` ·
[NameMC rxbow](https://namemc.com/profile/rxbow). No email.

## Scripts

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # → dist/
npm run preview
```

`base` is `./` in `vite.config.ts`, so the build runs from a subpath.
`.github/workflows/deploy.yml` publishes `dist` to GitHub Pages on every push to
`main`; the repository's Pages source must be set to **GitHub Actions**.

## Credits

- Layout reference: [qdran.de](https://www.qdran.de/).
- Type: Pirata One, EB Garamond and JetBrains Mono, all from Google Fonts
  (SIL Open Font License).
- Backdrop: Kentaro Miura, *Berserk* (Hakusensha). Used here as one-off fan
  artwork; swap or remove it if this page ever goes commercial.
