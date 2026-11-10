# rxbow

Personal page for **rxbow** (aka `ro161012`), built on the layout of
[qdran.de](https://www.qdran.de/) with a Berserk-manga treatment: inked paper,
screentone, drifting ash and a faint brand-style sigil behind the name.

Plain HTML, CSS and one ES module — Vite is only the dev server and bundler.

## What lives where

- `index.html` — the page: clock, wordmark, tagline, the four social rows.
- `src/style.css` — tokens, the background stack (ash canvas → ink wash,
  screentone and grain → vignette), the row list, responsive rules and the
  reduced-motion fallbacks.
- `src/main.js` — three small pieces:
  - the clock in the top right, local time with seconds plus the timezone label;
  - the ash canvas: depth-randomised embers and grey motes drifting upward with
    a per-particle sway, capped at 2× DPR, paused when the tab is hidden and
    rendered as a single static frame when the OS asks for reduced motion;
  - the Discord row copies `ro161012` and confirms with a toast.
- `favicon.svg` — the same sigil as the icon.

## Links

TikTok `@rxbowed` · Discord `ro161012` · Steam profile ·
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
