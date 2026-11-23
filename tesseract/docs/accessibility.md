# Tesseract — Accessibility

This is a delivery checklist, not a certification. It records what is
implemented in the code, what was verified by inspection, and what still needs a
manual or automated audit.

**Audit status:** source review complete. **Lighthouse, axe and screen-reader
passes have not been run.** No claim of WCAG conformance is made.

---

## How this was checked

- Read the shell, screens, dialog, charts, global stylesheet and glass engine.
- Checked landmark structure, skip link, focus styles, ARIA roles, form labels,
  chart fallbacks and the reduced-motion/contrast/forced-colors rules.
- Confirmed the production checks (`npm run check`, `npm run build`) compile the
  app; compilation does not prove runtime accessibility.
- Did **not** run Lighthouse, axe DevTools, VoiceOver, NVDA, a keyboard-only
  walkthrough, a zoom/reflow test or a contrast measurement.

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
| Course dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus moved to the close button, Escape and backdrop close it | `components/app/course-sheet.tsx` |
| Charts | Decorative SVG is `aria-hidden`; the figure has a visible caption and a visually hidden `<table>` with caption, headers and every point | `components/ui/ui.tsx` |
| Grade meaning | Percent/letter always accompany grade color; status chips carry text labels | screens, `components/ui/ui.tsx` |
| Live feedback | Toasts use `role="status"` and `aria-live="polite"`; loading states are announced | `shell.tsx`, `components/workspace/workspace.tsx` |
| Form controls | Inputs have visible labels; icon-only buttons have `aria-label`; switches use `aria-pressed` | `login-form.tsx`, settings, what-if |
| Section naming | Panels use `aria-labelledby` or `aria-label` | all screens |
| Reduced motion | `prefers-reduced-motion` shortens animations and transitions; a stored `data-reduce-motion` setting does the same | `app/globals.css` |
| Increased contrast | `prefers-contrast: more` raises text/line opacity and strengthens glass blur/rim | `app/globals.css` |
| Forced colors | `forced-colors: active` removes backdrop, glass layers, shadows and filters; surfaces use Canvas/CanvasText | `app/globals.css` |
| Glass without support | `@supports not (backdrop-filter…)` supplies an opaque-enough fallback surface | `app/globals.css` |
| Reorder alternative | Grade reorder has explicit “Move up” / “Move down” buttons with course names, not drag-only | `grades-screen.tsx` |
| Responsive layout | Mobile-first CSS from 360px, safe-area insets, vertical page scroll only | `app.module.css` |

---

## Known gaps

| Gap | Impact | Next step |
| --- | --- | --- |
| Course dialog does not trap Tab or explicitly restore focus to the trigger | Keyboard users can move behind the modal; closing may drop focus to the document | Add a focus trap and store/restore the invoking element |
| Contrast has not been measured | Glass text and muted labels may fall below 4.5:1 in some states | Run axe/contrast checks on login, dashboard, settings, dialog and light theme |
| Lighthouse and axe not run | Unknown automated findings (names, roles, contrast, best practices) | Run both against a production build |
| No screen-reader walkthrough | Announcement order and dialog behavior are unverified with real AT | Test VoiceOver + Safari and NVDA + Chrome on the demo |
| No keyboard-only full pass | Tab order across nav, filters, charts, what-if and settings is unverified | Walk every screen with Tab/Shift+Tab/Enter/Space/Escape |
| Zoom/reflow not tested | 200% zoom and 320px width may expose clipping | Test at 200% and 400% zoom and 320px width |
| Touch targets not audited individually | Shared tokens exist, but every small control was not measured | Measure icon buttons, chips and calendar cells at 360px |
| PWA install/offline not tested | Offline shell and install prompt are unverified on device | Install on Android/desktop, go offline, reload |
| Real HAC data not tested | Parsed pages may omit labels or present unexpected markup | Test with an anonymized real district account |

The dialog focus gap is the highest-priority code fix; the rest are audit steps.

---

## Manual test script

Run against a production build with demo data (`/?demo=1`).

1. **Keyboard:** Tab from the top of the page. Skip link appears first; Enter
   moves to `main`. Reach every nav item, marking-period control and course card
   with Tab. Open a course with Enter; press Escape; confirm the sheet closes.
2. **Dialog:** With the sheet open, Tab repeatedly. Confirm whether focus stays
   inside (currently it does not) and note where focus lands after closing.
3. **Screen reader:** Confirm page title, landmarks, nav names, course card
   names, grade values and the chart table are announced.
4. **Zoom/reflow:** At 200% and 400% zoom and 320px width, confirm no horizontal
   scrolling and no clipped controls.
5. **Motion/contrast:** Enable reduced motion, increased contrast and forced
   colors in the OS/browser. Confirm the backdrop and glass simplify and all text
   remains readable.
6. **Offline:** Install the PWA, load the dashboard, go offline, reload. Confirm
   the shell loads, the offline banner appears, and no API response is served
   from cache.
7. **Automated:** Run Lighthouse (Accessibility) and axe DevTools on login,
   dashboard, course sheet, tools and settings in both themes. Record scores and
   findings here.

---

## Design constraints that protect accessibility

- Glass is limited to chrome and the overall-average hero; numbers, tables,
  charts and long text sit on solid surfaces.
- Grade color is redundant with percent and letter, never the only signal.
- The reduced-motion, increased-contrast and forced-colors paths are part of the
  material, not an afterthought.
- Charts never rely on hover: the figure caption states the range and the hidden
  table exposes every value.
