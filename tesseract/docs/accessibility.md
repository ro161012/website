# Tesseract — Accessibility

This is a delivery checklist, not a certification. It separates what is
implemented in the code, what was measured on the production build, and what
still needs a person using assistive technology.

**Audit status (23 November 2026):** Lighthouse accessibility **100** on the
sign-in page and the demo dashboard; axe-core **0 violations** on sign-in,
dashboard, Grades, the open course dialog, Settings and the privacy page. The
course dialog's keyboard trap and focus restoration were exercised in Chromium.
Screen-reader, zoom/reflow, individual touch-target and PWA offline checks were
**not** run. No claim of WCAG conformance is made.

---

## How this was checked

- Built the production bundle (`npm run build`) and served it with `next start`
  on `http://localhost:3010`.
- **Lighthouse 12.8.2** (headless Brave 158 / Chromium) with
  `--only-categories=accessibility` against `/` and `/?demo=1` (final URL
  `/dashboard`). Both scored **1.00** with no failing audits, including
  `color-contrast`.
- **axe-core 4.10.3** injected through the Chrome DevTools Protocol at a
  1440×1000 viewport. Tags: WCAG 2.0/2.1 A and AA plus best-practice. Pages:
  `/`, `/dashboard` (Home), Grades, an open course dialog, Settings and
  `/privacy`. Every page returned **0 violations**.
- **Keyboard:** opened the first course card, checked that focus moved to the
  close button, pressed Shift+Tab from it (wrapped to the last control), then
  sent 24 consecutive Tab presses. Focus stayed inside the dialog for every
  step. Escape closed the dialog and returned focus to the invoking course
  button.
- **Reduced transparency:** the Windows setting was on
  (`EnableTransparency=1`), so the no-transparency condition was emulated with
  CDP `Emulation.setEmulatedMedia` and
  `prefers-reduced-transparency: reduce`. On both Tesseract and
  `https://rxbow.vercel.app/` the glass kept the same computed
  `backdrop-filter: url(#lens) blur(14px) saturate(1.4)`, the same
  `rgba(255, 255, 255, 0.08)` tint and the same inset rim. Tesseract's normal
  and reduced captures were byte-identical (MD5 `9427952e…`); the portfolio's
  captures include a live clock, so their hashes differ. Visual inspection of
  both pairs showed the same lens, rim and sheen in both modes.
- **Live account:** signed in through the configured district HAC with a real
  account on 23 November 2026. The dashboard, 8 current courses, course detail,
  Insights, Tools, Reports, Transcript, Attendance, Teachers and Settings
  rendered with no UI alerts; a non-current marking period returned an explicit
  `courses_missing` warning. The session was signed out and `/api/me` returned
  401 afterwards. No names or grades are recorded here.
- **Not run:** NVDA/VoiceOver, 200%/400% zoom, 320px reflow, per-control touch
  target measurement, or PWA install/offline on a device.

### Automated results

| View | Lighthouse a11y | axe violations | axe incomplete |
| --- | --- | --- | --- |
| Sign-in `/` | **1.00** | 0 | 1 (`color-contrast`) |
| Dashboard Home | **1.00** | 0 | 1 (`color-contrast`) |
| Grades | not run separately | 0 | 1 (`color-contrast`) |
| Course dialog | not run separately | 0 | 1 (`color-contrast`) |
| Settings | not run separately | 0 | 1 (`color-contrast`) |
| Privacy `/privacy` | not run separately | 0 | 1 (`color-contrast`) |

`color-contrast` is the one incomplete result on every page: axe cannot compute
a ratio where the sampled text sits over the fixed illustration and the glass
filter. It is not a violation. Lighthouse's own contrast audit passed on both
pages it tested, but the glass/backdrop combination still deserves a manual
spot check with a colour meter when the text or artwork changes. The legal
footer is the only text drawn straight on the backdrop, so re-measure it
whenever the ascii ink or the scrim changes; every other text layer sits on
glass or a solid surface.

The two dialog landmark violations found in the first pass
(`landmark-no-duplicate-banner`, `landmark-unique`) were fixed by changing the
sheet's `<header>` to a non-landmark container. The second pass returned zero
violations.

---

## Implemented and confirmed in source

| Area | What is in place | Where |
| --- | --- | --- |
| Document language and title | `<html lang="en">`, per-page metadata, `applicationName` | `app/layout.tsx` |
| Landmarks | Sidebar `<aside>`, workspace `<nav aria-label="Workspace">`, `<main id="main">`, mobile `<nav aria-label="Primary">` | `components/app/shell.tsx` |
| Skip link | “Skip to main content” link that becomes visible on focus and targets `#main` | `app/globals.css`, `shell.tsx` |
| Focus visibility | Global `:focus-visible` outline with offset, plus a light-theme color | `app/globals.css` |
| Touch targets | Shared `--glass-target: 44px`, applied to navigation and icon controls | `app/globals.css`, `app.module.css` |
| Current location | `aria-current="page"` on the active sidebar and mobile tab | `shell.tsx` |
| Course dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, initial focus on close, Tab/Shift+Tab trapped, Escape and backdrop close it, focus restored to the invoking card | `components/app/course-sheet.tsx` |
| Charts | Decorative SVG is `aria-hidden`; the figure has a visible caption and a visually hidden `<table>` with caption, headers and every point | `components/ui/ui.tsx` |
| Grade meaning | Percent/letter always accompany grade color; status chips carry text labels | screens, `components/ui/ui.tsx` |
| Live feedback | Toasts use `role="status"` and `aria-live="polite"`; loading states are announced | `shell.tsx`, `components/workspace/workspace.tsx` |
| Form controls | Inputs have visible labels; icon-only buttons have `aria-label`; switches use `aria-pressed` | `login-form.tsx`, settings, what-if |
| Section naming | Panels use `aria-labelledby` or `aria-label` | all screens |
| Reduced motion | `prefers-reduced-motion` shortens CSS animations and transitions; the decorative ASCII backdrop keeps playing, and the stored Reduce motion setting freezes it | `app/globals.css`, `components/backdrop/ascii-backdrop.tsx` |
| Reduced transparency | The material stays intact when `prefers-reduced-transparency: reduce` is active; no rule strips the lens, tint or rim | verified in Chromium, `app/globals.css` |
| Increased contrast | `prefers-contrast: more` raises text/line opacity, strengthens glass blur/rim and deepens the backdrop scrim | `app/globals.css` |
| Forced colors | `forced-colors: active` removes backdrop, glass layers, shadows and filters; surfaces use Canvas/CanvasText | `app/globals.css` |
| Glass without support | `@supports not (backdrop-filter…)` supplies an opaque-enough fallback surface | `app/globals.css` |
| Reorder alternative | Grade reorder has explicit “Move up” / “Move down” buttons with course names, not drag-only | `grades-screen.tsx` |
| Responsive layout | Mobile-first CSS from 360px, safe-area insets, vertical page scroll only | `app.module.css` |

---

## Remaining manual gaps

| Gap | Impact | Next step |
| --- | --- | --- |
| No screen-reader walkthrough | Announcement order, dialog behaviour and chart tables are unverified with real AT | Test NVDA + Chrome and VoiceOver + Safari on the demo |
| No keyboard-only full pass beyond the dialog | Tab order across filters, charts, what-if and settings is unverified end to end | Walk every view with Tab/Shift+Tab/Enter/Space/Escape |
| Zoom/reflow not tested | 200% and 400% zoom and 320px width may expose clipping | Test at 200% and 400% zoom and 320px width |
| Touch targets not audited individually | Shared tokens exist, but every small control was not measured | Measure icon buttons, chips and calendar cells at 360px |
| Contrast incomplete in axe | Automated contrast cannot resolve text over the illustration/glass | Spot-check with a colour meter; rerun if copy or artwork changes |
| PWA install/offline not tested | Offline shell and install prompt are unverified on device | Install on Android/desktop, go offline, reload |
| Real HAC data only sampled | One real account was smoke-tested; other districts and populated older terms may differ | Test each target district and a populated older marking period |

---

## Manual test script

Run against a production build with demo data (`/?demo=1`).

1. **Keyboard:** Tab from the top of the page. The skip link appears first;
   Enter moves to `main`. Reach every nav item, marking-period control and course
   card with Tab. Open a course with Enter.
2. **Dialog:** Focus starts on Close. Shift+Tab wraps to the last control; Tab
   repeatedly stays inside; Escape closes and focus returns to the course card.
3. **Screen reader:** Confirm page title, landmarks, nav names, course card
   names, grade values and the chart table are announced.
4. **Zoom/reflow:** At 200% and 400% zoom and 320px width, confirm no horizontal
   scrolling and no clipped controls.
5. **Motion/contrast/transparency:** Enable reduced motion, increased contrast,
   forced colors and “transparency effects off”. Confirm the backdrop and glass
   simplify as documented and all text remains readable.
6. **Offline:** Install the PWA, load the dashboard, go offline, reload. Confirm
   the shell loads, the offline banner appears, and no API response is served
   from cache.
7. **Automated:** Re-run Lighthouse (Accessibility) on `/` and `/?demo=1`, and
   axe on login, dashboard, Grades, the course dialog, Settings and privacy.
   Record scores and findings here.

---

## Design constraints that protect accessibility

- Glass is limited to chrome and the overall-average hero; numbers, tables,
  charts and long text sit on solid surfaces.
- Grade color is redundant with percent and letter, never the only signal.
- The reduced-motion, reduced-transparency, increased-contrast and forced-colors
  paths are part of the material, not an afterthought.
- Charts never rely on hover: the figure caption states the range and the hidden
  table exposes every value.
