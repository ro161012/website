# Tesseract — Architecture

**Every grade, in its place.**

Tesseract is an independent, privacy-first grade tracker for school districts
that use Home Access Center (HAC). It turns a district gradebook into a calm,
legible record: current averages, assignment history, trends, what-if planning,
attendance, reports and transcript.

This document describes the shipped architecture: system shape, module
boundaries, data model, API surface, liquid-glass material, security posture and
the delivery record for all six phases.

---

## 1. Product identity

| | |
| --- | --- |
| Name | **Tesseract** |
| Tagline | *Every grade, in its place.* |
| Mark | Five faceted panes around a shared center (`components/brand/logo-mark.tsx`) |
| Palette | Ink `#12181a`, paper `#e7eaea`, teal `#1b2427`, coral `#df7257`, lilac `#7f6fb2`, gold `#bd9138` |
| Type | Instrument Sans (UI) and Newsreader (display) |
| Voice | Quiet, precise, never alarmist; grades are information, not a verdict |

**Required legal notice**, shown in Settings and on the login screen:

> Independent app. Not affiliated with or endorsed by PowerSchool or any school
> district. Home Access Center is a trademark of PowerSchool. Use only with your
> own account and follow your school's acceptable-use policy.

The exact string lives in `lib/config/site.ts` as `SITE.legalNotice` and is
asserted by `tests/contracts.test.ts`.

---

## 2. Goals and boundaries

### Goals

- Read a student's own HAC data without ads, analytics or a grade database.
- Normalize inconsistent district markup into one typed, portable model.
- Make the data legible on a phone in one hand, in a few seconds.
- Work in demo mode for every screen, with no account.
- Degrade honestly: partial pages produce warnings, not blank screens.

### Non-goals (v1)

- Storing grade data server-side.
- Bypassing CAPTCHA, hardware MFA or district SSO.
- Writing anything back to HAC.
- Parent/teacher messaging, notifications or a social feed.
- A native app; the shared types are designed so an Android client can port them
  one-to-one later.

---

## 3. Stack decisions

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Server routes hold the HAC cookie jar; React Server Components keep the shell small |
| Language | TypeScript, `strict` | Parsed HTML is untrusted; the model is the safety boundary |
| Styling | Tailwind CSS v4 + CSS modules | Tokens/material live in CSS; screen layout stays scoped |
| Contracts | Zod 4 | Every parser, query and env-backed profile is validated at runtime |
| HTML parsing | cheerio + domhandler | Tolerant of real HAC markup, testable from saved fixtures |
| Charts | Hand-built SVG (`components/ui/ui.tsx`) | No canvas or client chart dependency; every chart ships a screen-reader table |
| Tests | Vitest | Fast fixture-driven parser and security tests |
| Hosting | Vercel, Node runtime | HAC needs server-side HTTP and cookies; the app is stateless |

No database. The HAC cookie jar lives inside an encrypted session cookie; local
history lives in the browser. This is a deliberate privacy boundary, not a
temporary omission.

---

## 4. System shape

```text
Browser
  │  same-origin fetch only
  ▼
Next.js route handlers (Node runtime)
  │  validate → guard → provider
  ├── HacProvider ──► lib/hac/http ──► district HAC (HTTPS, cookie jar)
  └── DemoProvider ─► in-process fixture model (no network)
  │
  └── encrypted session cookie ◄── AES-256-GCM + HKDF key
```

- The browser never calls HAC directly: CORS, cookies and SSRF policy belong on
  the server.
- Every data route returns the same envelope:
  `{ data, warnings, fetchedAt }` or `{ error: { code, message } }`.
- The provider interface is the seam between real HAC data and the demo model.
  Screens cannot tell which one answered.

### Request lifecycle

```text
GET /api/courses?mp=...
  → read encrypted session cookie
  → validate session shape and expiry
  → per-session rate limit
  → provider.getCourses(mp)
      → in-memory 60 s cache hit? return
      → HAC: fetch page(s), parse, Zod-validate, collect warnings
      → refresh HAC cookies into a sealed Set-Cookie response
  → providerJson(): envelope + private/no-store headers
```

Login is the only route that accepts credentials. It fetches the configured
district login page, extracts the anti-forgery and hidden fields, POSTs
credentials to the same-origin form action, detects failure/MFA/success, selects
the student when a picker exists, and seals the resulting cookie jar into the
session cookie. The sign-in form uses `HAC_DISTRICT_URL` by default. **Change**
opens the district autofill: it can fetch the public login page for a shared HAC
network and list every district that page publishes, then send the selected
picker value with the login POST. Passwords are never stored, logged or placed
in a URL.

The demo entry is a top-level `GET /api/auth/demo`. It creates an encrypted demo
session — no HAC cookies and no credentials — and redirects to `/dashboard`.
`/?demo=1` redirects to that route, so the demo can be linked from outside the
app. A rate-limited demo request returns to `/?demo=limited`.

---

## 5. File tree

```text
tesseract/
├─ app/
│  ├─ api/
│  │  ├─ assignments/upcoming/route.ts
│  │  ├─ attendance/route.ts
│  │  ├─ auth/
│  │  │  ├─ demo/route.ts          # encrypted demo session
│  │  │  ├─ login/route.ts
│  │  │  └─ logout/route.ts
│  │  ├─ courses/[id]/route.ts
│  │  ├─ courses/route.ts
│  │  ├─ hac/districts/route.ts    # shared-network district directory
│  │  ├─ me/route.ts
│  │  ├─ reports/route.ts
│  │  ├─ students/active/route.ts
│  │  ├─ students/route.ts
│  │  └─ transcript/route.ts
│  ├─ dashboard/
│  │  ├─ page.tsx                  # authenticated workspace entry
│  │  └─ dashboard.module.css
│  ├─ privacy/
│  │  ├─ page.tsx                  # solid-surface privacy note
│  │  └─ privacy.module.css
│  ├─ globals.css                  # glass tokens, base reset, focus and a11y modes
│  ├─ icon.svg
│  ├─ layout.tsx                   # fonts, metadata, ascii backdrop, glass provider, PWA
│  ├─ page.tsx                     # sign-in / demo redirect
│  └─ page.module.css
├─ components/
│  ├─ app/
│  │  ├─ app.module.css
│  │  ├─ course-sheet.tsx          # course detail dialog
│  │  ├─ grades-screen.tsx
│  │  ├─ home-screen.tsx
│  │  ├─ insights-screen.tsx
│  │  ├─ more-screen.tsx           # reports, transcript, attendance, teachers, settings
│  │  ├─ settings-screen.tsx
│  │  ├─ shell.tsx                 # boot, nav, data loading, toasts, offline banner
│  │  ├─ tools-screen.tsx
│  │  └─ what-if.tsx
│  ├─ auth/login-form.tsx          # default district, optional switcher, vault, demo
│  ├─ backdrop/ascii-backdrop.tsx  # animated ascii.rest tesseract behind the glass
│  ├─ brand/logo-mark.tsx
│  ├─ glass/glass.tsx              # portfolio SDF displacement lens
│  ├─ pwa/register-service-worker.tsx
│  ├─ ui/ui.tsx                    # segmented, charts, chips, skeletons, states
│  └─ workspace/
│     ├─ api.ts                    # typed same-origin client
│     ├─ course-panel.tsx          # earlier drawer, retained
│     ├─ format.ts                 # grade/date/sort helpers
│     └─ workspace.tsx             # earlier workspace, retained
├─ docs/
│  ├─ accessibility.md
│  └─ architecture.md              # this document
├─ lib/
│  ├─ api/
│  │  ├─ envelope.ts               # success/failure constructors, status map
│  │  ├─ guards.ts                 # login, data and demo rate limits
│  │  └─ route.ts                  # handleApi, providerJson, cache headers
│  ├─ client/
│  │  ├─ grades.ts                 # averages, GPA, grade math
│  │  ├─ insights.ts               # snapshot diffs and movers
│  │  ├─ snapshots.ts              # IndexedDB history
│  │  ├─ storage.ts                # settings and last-payload storage
│  │  └─ vault.ts                  # PBKDF2 + AES-GCM credential vault
│  ├─ config/
│  │  ├─ hac-networks.ts           # verified shared HAC networks + types
│  │  ├─ hac.ts                    # configured district URL
│  │  └─ site.ts                   # identity and legal copy
│  ├─ demo/session.ts              # demo session payload
│  ├─ hac/
│  │  ├─ auth.ts                   # login form, student picker, session handshake
│  │  ├─ cookies.ts                # cookie jar
│  │  ├─ districts.ts              # shared-host district selector parser
│  │  ├─ html-form.ts              # form extraction and credential scrubbing
│  │  ├─ http.ts                   # fetch policy, redirects, timeouts
│  │  ├─ parsers.ts                # grades, assignments, attendance, reports
│  │  ├─ profiles.ts               # default + per-district paths/selectors/quirks
│  │  └─ url.ts                    # HTTPS/SSRF/host allowlist policy
│  ├─ providers/
│  │  ├─ cache.ts                  # 60 s in-process, session-scoped cache
│  │  ├─ demo.ts                   # realistic 7-course fixture model
│  │  ├─ hac.ts                    # HAC provider implementation
│  │  ├─ index.ts                  # provider selection by session mode
│  │  └─ types.ts                  # DataProvider interface
│  ├─ security/
│  │  ├─ errors.ts                 # typed, safe API problems
│  │  ├─ rate-limit.ts             # in-memory per-IP / per-user windows
│  │  └─ request.ts                # same-origin, JSON, body-size checks
│  ├─ session/
│  │  ├─ crypto.ts                 # HKDF + AES-256-GCM seal/open, cookie rules
│  │  ├─ current.ts                # read session from request, set cookie
│  │  └─ schema.ts                 # session payload and TTL invariants
│  └─ types/
│     ├─ academics.ts              # Course, Category, Assignment, reports
│     ├─ api.ts                    # request/response contracts
│     ├─ attendance.ts             # AttendanceDay, statuses, month format
│     ├─ common.ts                 # IDs, dates, envelopes, error codes
│     ├─ index.ts
│     ├─ people.ts                 # Student, District, Teacher, Contact
│     └─ snapshots.ts              # local history snapshots
├─ public/
│  ├─ icon-192.png
│  ├─ icon-512.png
│  ├─ manifest.webmanifest
│  └─ sw.js                        # app-shell cache; /api bypassed
├─ tests/
│  ├─ fixtures/                    # anonymized HAC HTML and model fixtures
│  ├─ auth.test.ts
│  ├─ contracts.test.ts
│  ├─ cookies.test.ts
│  ├─ demo.test.ts
│  ├─ grades.test.ts
│  ├─ html-form.test.ts
│  ├─ http.test.ts
│  ├─ insights.test.ts
│  ├─ login-form.test.ts
│  ├─ parsers.test.ts
│  ├─ profiles.test.ts
│  ├─ rate-limit.test.ts
│  ├─ request.test.ts
│  ├─ rrisd.test.ts
│  ├─ session.test.ts
│  └─ ssrf.test.ts
├─ .env.example
├─ next.config.ts                  # CSP, HSTS, frame denial, permissions policy
├─ package.json
├─ postcss.config.mjs
├─ tsconfig.json
├─ vitest.config.ts
└─ README.md
```

`components/workspace/workspace.tsx` and `course-panel.tsx` are the earlier
workspace views; the dashboard mounts `components/app/shell.tsx`. The shared
`workspace/api.ts` and `workspace/format.ts` are still used by the new screens.

---

## 6. Data model

All contracts are Zod schemas in `lib/types`, exported as TypeScript types with
the same names. Parse at every boundary; never cast untrusted data.

### Core entities

| Type | Key fields | Invariants |
| --- | --- | --- |
| `District` | `id`, `name`, `baseUrl`, `profileId` | HTTPS base URL, no trailing slash, app-scoped id |
| `Student` | `id`, `displayName`, grade/school/homeroom, counselor | Stable opaque id; no credentials |
| `Teacher` / `Contact` | `name`, `email`, `phone`, `room` | Email only when HAC provides it |
| `MarkingPeriod` | `id`, `name`, `sequence`, dates, `isCurrent` | Unique id per term; ordered by sequence |
| `CourseSummary` | course identity, teacher, period/room, level, credits, `grade`, `classAverage` | `level` is a closed enum; percent is nullable |
| `Course` | summary + `categories` + `assignments` | Every assignment belongs to this course; non-null category ids must exist |
| `Category` | name, weight, earned/possible, average, position, assignment ids | Weight is a percentage when provided |
| `Assignment` | name, due/assigned date, score, possible, percent, status, extra credit, comment, position | Closed status set: graded, missing, late, exempt, not graded, unknown |
| `AttendanceDay` | date, status, code, reason, note, periods | One record per date; status enum includes present/absent/tardy/excused/remote/no school |
| `ReportCard` | kind, title, marking period, year, issued date, entries, GPA, absences, tardies | `kind` is report card or progress report |
| `Transcript` | GPA summary, class rank, credits, entries | Rank position ≤ class size; entries may be excluded from GPA |
| `Snapshot` | student, marking period, capturedAt, per-course grade + assignment hashes | Local-only; compact enough for IndexedDB |
| `ApiError` | code, message, optional safe details | Error codes map to 4xx/5xx; messages contain no PII |

### Envelope

```ts
interface ApiSuccess<T> {
  data: T;
  warnings: Warning[];
  fetchedAt: string; // ISO 8601 with offset
}

interface ApiFailure {
  error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> };
}
```

Warnings are non-fatal parser or adapter problems (`code`, `message`, optional
`path`). A missing selector should downgrade one section to a warning while the
rest of the page renders.

### Derived (not persisted server-side)

- Letter grade from percent and configurable thresholds.
- Trend versus the previous local snapshot.
- “New” dot from assignment-hash differences.
- Overall average/GPA from course summaries and settings.
- Missing/upcoming lists from assignment status and due dates.
- What-if estimates recomputed from category weights and hypothetical scores.

---

## 7. API surface

All routes are Node runtime, `force-dynamic` and private (`no-store`). Login,
demo, logout and the district directory are the only public routes.

| Method | Route | Input | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | JSON `{ districtUrl?, districtId?, username, password, campusId? }` | `LoginResult` + sealed cookie |
| GET | `/api/hac/districts` | `?url=` | District picker options for a HAC login page |
| GET | `/api/auth/demo` | — | Demo session cookie, redirect to `/dashboard` |
| POST | `/api/auth/logout` | — | `{ ok: true }`, cookie cleared |
| GET | `/api/bootstrap` | `?mp=` | `{ me, courses, upcoming }` in one round trip |
| GET | `/api/me` | — | `MeData` |
| GET | `/api/students` | — | `Student[]` |
| POST | `/api/students/active` | `{ studentId }` | Active `Student` |
| GET | `/api/courses` | `?mp=` | `CourseSummary[]` |
| GET | `/api/courses/[id]` | `?mp=` | `Course` |
| GET | `/api/assignments/upcoming` | `?days=` (1–60) | `AssignmentWithCourse[]` |
| GET | `/api/attendance` | `?month=YYYY-MM` | `AttendanceDay[]` |
| GET | `/api/reports` | — | `ReportCard[]` |
| GET | `/api/transcript` | — | `Transcript` |

The sign-in form normally omits `districtUrl` and the server uses
`HAC_DISTRICT_URL`. A district chosen through **Change** is sent explicitly and
validated against the same HTTPS/SSRF policy used for every HAC request. The
directory route fetches only the public login page; no credentials are involved.
The selected `districtId` is the exact option value from that page, and the login
server uses the option's canonical name in the session.

---

## 8. HAC adapter

### Profile model

One adapter; all district variance lives in a validated profile:

```ts
{
  id, label, version, matchHosts,
  paths: { login, home, schedule, classSchedule, classwork, attendance,
           transcript, reportCard },
  selectors: { assignment, courseTitle, categoryWeight, assignmentScore, ... },
  quirks: { userAgent, loginFormSelector, invalidLoginMarkers, mfaMarkers,
            ssoHostSuffixes, attendanceCalendar, transcriptGroupedByYear, ... }
}
```

- `DEFAULT_PROFILE` covers shared HAC structure.
- Built-in overrides cover Round Rock ISD; `HAC_PROFILES` adds or overrides
  profiles as JSON, with `baseProfile` inheritance.
- Unknown keys, traversal paths, malformed JSON and cycles fail closed.
- Selectors never leak into routes or components.

### Parsing rules

- Parse with cheerio, normalize whitespace and non-breaking spaces, then
  Zod-validate each object.
- Locate tables by stable ids/classes before falling back to positional headers.
- Deduplicate assignments by a stable synthesized id (course + category + name
  + due date + position).
- Distinguish “no score yet” from zero; preserve extra credit and exemptions.
- Collect a warning instead of throwing when one section is absent.
- Tests use anonymized saved HTML under `tests/fixtures`; never real student
  data.

### Network policy

- HTTPS only, port 443, no userinfo, no query string on district base URLs.
- No IP literals, localhost, `.local`, `.internal`, private/link-local ranges or
  IPv4-mapped IPv6 bypasses.
- Optional `HAC_ALLOWED_HOST_SUFFIXES` allowlist.
- DNS is resolved and private answers are rejected; the request is pinned to the
  validated address.
- Redirects are capped, revalidated, and restricted to the district host or
  configured SSO suffixes.
- Descriptive `User-Agent`, request timeout, and a 60-second in-process cache.
- Login, demo and data routes are rate-limited per IP / username / session.

---

## 9. Session and secrets

- `SESSION_SECRET` (≥ 32 bytes) → HKDF-SHA256 → 32-byte AES key.
- AES-256-GCM with a random 12-byte IV and authentication tag; base64url token
  prefixed `v1.`.
- Payload: mode, district, HAC cookie jar, students, active student, issuedAt,
  expiresAt. Never a password, username or grades.
- TTL: 12 hours; expired or tampered tokens are rejected and the UI asks for
  re-authentication.
- Cookie: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` and `__Host-` prefix
  in production, 12-hour max age.
- Mutations require JSON and same-origin / `Sec-Fetch-Site` checks.
- Security headers (CSP, HSTS in production, frame denial, nosniff, permissions
  policy) are set in `next.config.ts`.
- Demo sessions use the same encrypted envelope with no HAC jar or credentials.

---

## 10. UI architecture and liquid glass

### Material layers

1. **Backdrop** — the animated `starfield` piece from
   [`ascii.rest`](https://github.com/bas3line/ascii) (MIT), rendered as a fixed
   64×24 text layer under an ink scrim. The app's stored Reduce motion setting
   freezes it; otherwise it plays, including under an OS reduced-motion
   preference.
2. **Chrome glass** — floating top bar, desktop sidebar, mobile tab bar,
   segmented controls, course sheet, toasts and the overall-average hero card.
3. **Solid data surfaces** — assignment tables, charts, long lists and reports.
   No glass behind numbers.
4. **Flat controls inside glass** — never glass-on-glass.

### Glass engine

`components/glass/glass.tsx` is the portfolio's material, ported unchanged:

- A rounded-rectangle signed-distance field generates a displacement map in a
  canvas for each instance; the result is an SVG `feImage`/`feDisplacementMap`
  filter sized to the element and regenerated through `ResizeObserver`.
- Chromium applies the filter through `backdrop-filter: url(#…) blur()`;
  separate R/B scale offsets produce the chromatic fringe.
- A specular rim and pointer-tracked sheen sit above the refracted layer.
- `app/globals.css` holds the optical tokens (tint `0.08`, rim `0.6`, blur
  `14px`, fallback blur `14px`, refraction `48`, bezel `22px`, chroma `0.5`,
  target `44px`, card radius `32px`) so the material is tuned in one place.
- Browsers without SVG `backdrop-filter` support fall back to blur + rim.
- `prefers-reduced-motion`, `prefers-contrast: more` and `forced-colors` each
  switch the material down; `forced-colors` removes the backdrop and filter
  entirely.

### Screen composition

`components/app/shell.tsx` owns session boot, marking-period selection, data
loading, saved-course state, snapshot capture, offline/refresh state, toasts and
the course sheet. Screens receive loaded data and callbacks:

- **Home** — overall average hero, quick statistics, upcoming/missing work and
  local snapshot trend.
- **Grades** — course cards, missing/upcoming counts, hide/reorder controls,
  overall strip and course detail dialog.
- **Insights** — snapshot trend chart, biggest movers, momentum and recent
  changes; charts include hidden data tables.
- **Tools** — RRISD weighted 6.0 / unweighted 4.0 GPA calculator with editable
  rows (average, credits, weighting, affects-GPA) and a what-if planner by
  assignment or category.
- **More** — report cards, transcript, attendance calendar, teacher directory
  and the Settings tab.
- **Settings** — theme, accent, grade thresholds, GPA options, glass intensity,
  local-data export/delete and the legal notice.

### Accessibility contract

- AA contrast (≥ 4.5:1) for text on glass, weight ≥ 500.
- 44px touch targets and visible `:focus-visible` rings.
- Correct roles for tabs, dialogs, switches and sliders.
- Grade color is never the only signal; percent/letter always accompany it.
- Charts include a screen-reader table fallback.
- `prefers-reduced-motion`, `prefers-contrast` and `forced-colors` each have a
  defined mode.
- Keyboard reorder alternatives on grade cards.

The status of each item, including checks not yet run, is recorded in
[`docs/accessibility.md`](accessibility.md).

### Layout

Mobile-first from 360px; floating bottom tabs (Home, Grades, Insights, Tools,
More); glass sidebar on desktop; safe-area insets; no horizontal overflow;
skeletons, empty states and retryable error states for every fetch.

---

## 11. Local data (client-only)

| Store | Contents | Cleared by |
| --- | --- | --- |
| IndexedDB | Compact snapshots (grades + assignment hashes) for trends and “new” dots | “Delete local data” |
| localStorage | Theme, accent, thresholds, GPA scale, hidden/reordered classes, glass intensity, saved districts, last payload | “Delete local data” |
| Web Crypto vault | Optional encrypted credentials behind a master password | “Sign out and delete all local data” |

Credentials never go to IndexedDB, localStorage or the service worker cache in
plaintext. The vault derives a key with PBKDF2 → AES-GCM and only decrypts on an
explicit unlock.

---

## 12. Security checklist

| Requirement | How it is met |
| --- | --- |
| HTTPS only | URL policy rejects non-HTTPS; HSTS in production |
| Strict CSP / headers | `next.config.ts` locks scripts, styles, images, fonts, frames |
| No grade-data analytics | No third-party scripts or analytics dependencies |
| No PII logging | Errors are typed and sanitized; no credential/cookie logs |
| Secrets via env | `SESSION_SECRET`, district/profile settings only |
| Login rate limit | Per-IP/minute and per-username/hour |
| Demo rate limit | Per-IP guard before the demo session is created |
| Directory rate limit | Per-IP guard before fetching a public HAC district list |
| Cookie flags | HttpOnly, SameSite=Strict, `__Host-` + Secure on HTTPS deployments; a plain `tessera_session` cookie only for a local http preview |
| Logout race | A short-lived HttpOnly logout marker rejects an in-flight response that tries to re-issue the session cookie |
| Constant-time compares | Session authentication is delegated to GCM tag verification |
| Dependency pinning | Exact versions in `package.json`, lockfile committed |
| CSRF | SameSite plus explicit same-origin/JSON checks on mutations |
| SSRF | Scheme/port/host/DNS validation, pinning, redirect checks |
| PWA cache | Service worker bypasses every `/api/` request |
| Privacy statement | `/privacy`, linked from Settings |

---

## 13. Delivery record

All six phases are implemented in this repository.

| Phase | Scope | Status |
| --- | --- | --- |
| **1 — Foundation** | Identity, architecture, file tree, typed data model, README/setup | **Complete** |
| **2 — Data** | HAC adapter, configured-district login, shared-network district autofill, saved districts, `?demo=1`, API parity, encrypted session | **Complete** |
| **3 — Material** | Glass tokens, backdrop, SDF refraction, chrome components, a11y modes | **Complete** |
| **4 — Core screens** | Login, Home, Grades, course detail, Insights, Tools | **Complete** |
| **5 — Rest** | Reports, transcript, attendance, teachers, settings, PWA/offline, privacy | **Complete** |
| **6 — Proof** | Tests, accessibility record, build verification | **Complete** |

Test coverage at delivery: 118 tests across 17 files, including grade math,
insight diffs, local snapshots, contracts, session crypto, SSRF policy, rate
limits, HAC district-picker parsing, parsers and district profiles. `docs/accessibility.md` records the
actual audits: Lighthouse 12.8.2 scored 100 on sign-in and dashboard, axe-core
4.10.3 found 0 violations on six views, and the course dialog's focus trap and
restoration were exercised in Chromium. Screen-reader, zoom and offline checks
remain manual.

A real-account smoke test on 23 November 2026 signed in through the configured
HAC and loaded 8 current courses, a course detail, 3 upcoming assignments, 63
attendance days, one report, the transcript, teachers and settings with no UI
alerts. Switching to a non-current marking period returned no course card
markup; the app surfaced `courses_missing` and restored the current period. The
live session stayed encrypted; as designed, the dashboard also wrote compact
local snapshots and a last-data cache, which were removed after the smoke test.

### Known limitations

- District HAC markup varies; a profile may be required and real-account login
  has not been verified for every district.
- CAPTCHA, hardware MFA and SSO are surfaced as typed failures, not bypassed.
- Vercel's in-memory rate limiter and cache are best-effort across instances.
- Glass refraction is Chromium-only; other browsers get the baseline material.
- Screen-reader, zoom/reflow, touch-target and PWA offline checks remain
  manual; see `docs/accessibility.md`.
