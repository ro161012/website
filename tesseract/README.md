# Tesseract

**Every grade, in its place.**

Tesseract is an independent, privacy-first grade tracker for school districts
that use Home Access Center (HAC). It turns a district gradebook into a calm,
legible record: current averages, assignment history, trends, what-if planning,
attendance, reports and transcript.

- **No ads, analytics or grade database.**
- **Your password is never stored.** It is used once to sign in and discarded.
- **Demo data is built in.** Every provider call has a fixture-backed
  counterpart, so the whole app works without an account.
- **Independent.** Not affiliated with PowerSchool or any school district.

> **Status — all six delivery phases implemented.** The workspace, liquid-glass
> material, local history, PWA, privacy page and test suite are in place. See
> [`docs/architecture.md`](docs/architecture.md) for the system reference and
> [`docs/accessibility.md`](docs/accessibility.md) for the accessibility record.

---

## Run it locally

Requirements: Node.js 20.9 or newer, npm, and a modern browser.

```bash
cd tesseract
npm install
cp .env.example .env.local
```

Set `SESSION_SECRET` in `.env.local` to at least 32 random bytes:

```bash
openssl rand -base64 32
```

Then start the development server:

```bash
npm run dev
# http://localhost:3000
```

### Try it without a HAC account

Open **http://localhost:3000/?demo=1**, or choose **Explore the demo** on the
sign-in card. Either path creates an encrypted demo session and opens the
dashboard with seven courses, three marking periods, attendance, reports and a
transcript. Demo data is generated in-process; no network request leaves the
server.

Signing in with a real account requires the district HAC address, your own
username and password. The district address is entered on the sign-in form and
can be saved for next time.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Strict TypeScript, no emit |
| `npm run test` | Vitest fixture and unit suite |
| `npm run check` | Lint + typecheck + tests (the pre-merge gate) |

---

## What is in the app

| Area | What it does |
| --- | --- |
| Sign in | District URL with saved districts, password sign-in, encrypted local vault, demo entry, session-expiry handling |
| Home | Overall average, quick statistics, upcoming and missing work, local snapshot trend |
| Grades | Marking-period switcher, course cards, missing/upcoming counts, hide and reorder, course detail sheet with categories, assignments and trend |
| Insights | Local snapshot history, biggest movers, momentum, recent grade changes |
| Tools | Weighted/unweighted GPA calculator, configurable scale and thresholds, per-assignment and hypothetical what-if planning |
| More | Report cards, transcript, monthly attendance calendar, teacher directory, settings |
| Settings | Theme, accent, grade thresholds, GPA scale, glass intensity, data export/delete, legal notice |
| PWA | Installable manifest, app icons, offline shell; API requests are never cached |

Multiple students are supported when the district session or demo contains more
than one. Local snapshots, settings and the optional encrypted vault live in the
browser; “Delete local data” removes them.

---

## Liquid glass

The material is ported from the portfolio design, not approximated:

- `components/glass/glass.tsx` contains the same signed-distance-field
  displacement map, per-instance SVG filter, chromatic R/B split, specular rim
  and pointer sheen.
- `app/globals.css` carries the same optical tokens: tint `0.08`, rim `0.6`,
  blur `14px`, fallback `14px`, refraction `48`, bezel `22px`, chroma `0.5`,
  target `44px`, card radius `32px`.
- Glass is limited to chrome and the overall-average hero: sidebar, top bar,
  mobile tabs, segmented controls, sheets and toasts. Tables, lists, charts and
  long-form text stay on solid surfaces.
- Browsers without `backdrop-filter` get a readable translucent fallback;
  `prefers-reduced-motion`, `prefers-contrast: more` and `forced-colors` each
  have defined behavior in `app/globals.css`.

Charts are hand-built SVG (`components/ui/ui.tsx`) with screen-reader table
fallbacks; no client chart library is installed.

---

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | **Yes** | ≥ 32 bytes; derives the AES-256-GCM session key via HKDF |
| `HAC_DISTRICT_URL` | No | Default district HAC base URL for the sign-in form |
| `HAC_ALLOWED_HOST_SUFFIXES` | No | Comma-separated host suffixes the server may contact; empty applies the default SSRF guard to public HTTPS hosts |
| `HAC_PROFILE` | No | Force one configured profile id for every district |
| `HAC_PROFILES` | No | JSON array of district-specific profile overrides |
| `NEXT_PUBLIC_APP_URL` | Production | Public origin, e.g. `https://tesseract.example`; used for same-origin checks and metadata |

`SESSION_SECRET` must be set before any sign-in. Generate it once per
environment; rotating it invalidates existing sessions.

---

## Architecture and data model

Read [`docs/architecture.md`](docs/architecture.md) for the full reference:
system diagram, request lifecycle, file tree, entity invariants, API surface,
adapter profile model, glass layers, security checklist and delivery record.

The short version:

- **Next.js App Router + Node route handlers.** Browsers cannot call HAC
  directly (CORS and cookies), so the server is a stateless proxy.
- **One adapter, profile-driven.** Paths and selectors live in
  `lib/hac/profiles.ts`, never in routes or components.
- **Zod at every boundary.** Parsers, query strings and session payloads are
  validated; failures become typed errors or non-fatal warnings.
- **Provider seam.** `HacProvider` and `DemoProvider` implement the same
  `DataProvider` interface, so screens cannot tell them apart.
- **Encrypted cookie session.** The HAC cookie jar, district and student list
  live in an AES-256-GCM token; no database and no server-side grades.
- **Local-first history.** Snapshots in IndexedDB and settings in localStorage
  power trends and “new” indicators without uploading anything.
- **Uniform API envelope.** `{ data, warnings, fetchedAt }` on success,
  `{ error: { code, message } }` on failure.

### HAC adapter profiles

The generic profile covers the shared HAC structure. Override paths, selectors
or quirks per district with `HAC_PROFILES` (a JSON array), or force a profile
with `HAC_PROFILE`.

```json
[
  {
    "id": "our-district",
    "label": "Our district",
    "matchHosts": ["hac.example.k12.us", "*.example.k12.us"],
    "paths": {
      "schedule": "/HomeAccess/Content/Student/Classes.aspx",
      "attendance": "/HomeAccess/Content/Attendance/MonthlyView.aspx"
    },
    "selectors": {
      "assignment": "div.CourseCard",
      "courseAverage": "span[id*='Average']"
    },
    "quirks": {
      "attendanceCalendar": true,
      "ssoHostSuffixes": ["login.example.k12.us"]
    }
  }
]
```

`baseProfile` inherits from another profile. Unknown keys, traversal paths,
non-HTTPS URLs, malformed JSON and inheritance cycles fail closed. Keys merge
over the generic profile, so an override only needs the values that differ.
Round Rock ISD is included as a worked built-in example.

### Debug a failed parse

1. Check the response `warnings[]` first. A warning names the missing section
   (for example `assignments_unavailable`) while the rest of the page renders.
2. Confirm the district's page paths. A profile can override any of `login`,
   `home`, `schedule`, `classSchedule`, `classwork`, `attendance`, `transcript`
   and `reportCard`.
3. Save anonymized HTML to `tests/fixtures` — remove names, emails, student ids
   and grades first. Never commit real student data.
4. Add or adjust the selectors in a profile entry. Prefer stable ids/classes
   over positional `nth-child` chains where HAC offers them.
5. Run the parser suite:

   ```bash
   npm run test -- tests/parsers.test.ts tests/rrisd.test.ts
   ```

6. Re-check `npm run check`. If a page is structurally different, return a
   partial result plus a warning rather than throwing for the whole screen.

---

## Tests and accessibility

```bash
npm run check
```

The suite covers contracts, session crypto, cookies, SSRF policy, rate limits,
same-origin checks, login form extraction, HAC parsers, district profiles, the
demo provider, grade math, insight diffing and local snapshots.

Accessibility is documented in [`docs/accessibility.md`](docs/accessibility.md):
implemented behavior is listed separately from checks that still need a manual
or automated audit. Lighthouse has not been run as part of this build.

---

## PWA and offline behavior

- `public/manifest.webmanifest` declares the installable app, theme color and
  icons (`icon-192.png`, `icon-512.png`).
- `public/sw.js` pre-caches the app shell and serves a cached page when offline.
  Requests to `/api/` bypass the cache entirely, so grades are never written to
  the service worker cache.
- `components/pwa/register-service-worker.tsx` registers the worker only in a
  production build, so local development is never stuck on stale assets.
- The workspace shows an offline banner and keeps the last successful payload in
  memory for the current session.

---

## Deploy to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repository.
3. Set **Root Directory** to `tesseract`.
4. Framework preset: **Next.js**. Build command `npm run build`, output
   `.next`. Node.js 20.9+.
5. Add environment variables for Production, Preview and Development:
   - `SESSION_SECRET` — generate a separate 32+ byte secret per environment.
   - `NEXT_PUBLIC_APP_URL` — the deployment origin, e.g.
     `https://tesseract.example`.
   - `HAC_DISTRICT_URL` (if the district is fixed) and any `HAC_PROFILES`,
     `HAC_ALLOWED_HOST_SUFFIXES`.
6. Deploy. The API routes run on the Node.js runtime; no database, cron or
   additional service is required.
7. After the first deploy, sign in with your own account and verify the
   district paths. A successful build does not prove a district's HAC markup
   parses; see “Debug a failed parse”.

Rotating `SESSION_SECRET` signs everyone out. Do not put secrets in
`NEXT_PUBLIC_*` variables; those are public.

---

## Privacy and data handling

- Credentials are POSTed once to our own API route over HTTPS, used for the HAC
  login, and discarded. They are never written to a database, file, log or URL.
- The encrypted session cookie holds the HAC cookie jar, district, student list
  and expiry — not grades and not your password. It lasts at most 12 hours and
  is `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- Grade data is fetched on demand and cached in memory for at most 60 seconds
  per session. There is no grade database.
- Local snapshots, theme/settings and the optional encrypted credential vault
  live in the browser and can be removed with “Delete local data”.
- No third-party analytics, ads or tracking scripts.
- HAC pages protected by CAPTCHA, hardware MFA or district SSO return a typed
  `mfa_required`/`parse_failed` result; Tesseract does not bypass those controls.

The full note is at `/privacy` and is linked from Settings.

---

## Known limitations

- District HAC markup varies. Real-account sign-in has not been verified for
  every district; a profile may be required.
- CAPTCHA, hardware MFA and district SSO are surfaced as typed failures, not
  bypassed.
- The in-memory cache and rate limiter are per server instance. Vercel may run
  more than one instance, so limits are best-effort.
- Glass refraction is Chromium-only; other browsers receive the baseline blur
  and rim material. Reduced-motion, high-contrast and forced-colors modes are
  supported.
- Lighthouse, axe and screen-reader passes have not been run; see
  `docs/accessibility.md` for the remaining manual checks.

---

## Legal

Independent app. Not affiliated with or endorsed by PowerSchool or any school
district. Home Access Center is a trademark of PowerSchool. Use only with your
own account and follow your school's acceptable-use policy.
