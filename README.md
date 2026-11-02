# Campus — Multi-Tenant Student & Developer Dashboard

One calm place for classes, code, and focus. A full-stack Next.js app where every
account gets its own isolated slice of tasks, courses, snippets, notes, and focus
sessions — in English or Arabic, light or dark.

```
Assignments · GPA calculator · Snippet manager (shareable) · Pomodoro + analytics · Scratchpad · Syllabus tracker · Dev utilities · Project portfolio
```

---

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, Server Components, Route Handlers)     |
| Language   | TypeScript (strict)                                            |
| Styling    | Tailwind CSS v4 + shadcn/ui primitives, OKLCH theme tokens     |
| Motion     | Framer Motion (layout transitions, list enter/exit)            |
| Database   | PostgreSQL 14+ (tested on 18) + Prisma 6                     |
| Auth       | NextAuth / Auth.js v5 — Google OAuth + email & password        |
| Theming    | `next-themes` (class strategy, system-aware)                   |
| i18n       | Typed dictionaries + React context, cookie-persisted, full RTL |
| Toasts     | Sonner                                                         |

---

## Quick start

```bash
cd "campus dashboard"
npm install

# 1. Environment
cp .env.example .env
# then set AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Database (either Docker or your own Postgres)
docker compose up -d

# 3. Schema + demo data
npm run db:push
npm run db:seed

# 4. Run
npm run dev
```

Open <http://localhost:3000>. The seed creates three demo accounts, all with the
password `campus1234`. To make yourself the admin, register (or have an admin
create) your account, then run:

```bash
npm run db:promote -- s-o.ali77@zewail.edu.eg
```

| Email                           | Role  | Status  | What it shows                              |
| ------------------------------- | ----- | ------- | ------------------------------------------ |
| `s-o.demo77@zewailcity.edu.eg`  | User  | Active  | Full workspace with demo data (tasks, courses, snippets…) |
| `s-o.mariam31@zewailcity.edu.eg`| User  | Active  | An approved student with a little activity |
| `s-o.nour12@zewailcity.edu.eg`  | User  | Pending | The waiting screen at `/pending`           |

Create an account at `/register`. A Google sign-in with a verified
`@zewail.edu.eg` address is activated automatically. Password sign-ups wait for
an admin to approve them, because entering a campus address alone does not prove
ownership. Every account starts with its own private workspace.

> No Docker? Point `DATABASE_URL` at any Postgres 14+ instance and run
> `npm run db:push && npm run db:seed`.

---

## Environment variables

Every variable lives in `.env.example`. `.env` is git-ignored.

| Variable                | Required | Notes                                                            |
| ----------------------- | :------: | ---------------------------------------------------------------- |
| `DATABASE_URL`          |    ✅    | Postgres connection string (matches `docker-compose.yml`).       |
| `AUTH_SECRET`           |    ✅    | Signing key. App throws at boot if missing.                      |
| `AUTH_URL`              |    —     | Base URL for Auth.js callbacks (defaults to the request origin).  |
| `AUTH_TRUST_HOST`       |    —     | Set `true` behind a proxy / on a LAN IP.                         |
| `AUTH_GOOGLE_ID`        |    —     | With the next var, enables the Google button.                    |
| `AUTH_GOOGLE_SECRET`    |    —     | Leave blank to hide Google sign-in entirely.                     |
| `ALLOWED_EMAIL_DOMAIN`  |    —     | Lock registration to a campus domain, e.g. `zewail.edu.eg`.  |
| `NEXT_PUBLIC_APP_URL`   |    —     | Used in metadata.                                                |

Google OAuth is optional by design: the provider is registered only when both
credentials are present, so email/password works out of the box. Authorized
redirect URI: `http://localhost:3000/api/auth/callback/google`.

Google sign-ins with a verified `@zewail.edu.eg` address are approved
automatically. Password sign-ups require admin approval. Set
`ALLOWED_EMAIL_DOMAIN=zewail.edu.eg` to block registrations from other domains;
leave it blank to accept them for admin review.

---

## Scripts

| Script              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Dev server on :3000                                 |
| `npm run build`     | `prisma generate` + production build                |
| `npm start`         | Serve the production build                          |
| `npm run lint`      | ESLint (flat config)                                |
| `npm run typecheck` | `tsc --noEmit`                                      |
| `npm run db:push`   | Sync schema without a migration (fast path for dev) |
| `npm run db:migrate`| Create + apply a migration (use this in real repos) |
| `npm run db:deploy` | Apply pending migrations in CI/production           |
| `npm run db:seed`   | Rebuild the three demo accounts                     |
| `npm run db:promote`| `-- <email>` promotes + approves that account        |
| `npm run db:studio` | Prisma Studio                                       |

`db:seed` is idempotent: it deletes and recreates only the three demo addresses
(`s-o.demo77@…`, `s-o.mariam31@…`, `s-o.nour12@…`) and their rows, so your own
accounts are untouched.

### Becoming the first admin

Verified campus Google sign-ins are active immediately. Password sign-ups need
admin approval. To create the first admin, register and promote the account
out of band:

```bash
# register normally, then:
npm run db:promote -- you@zewail.edu.eg
```

The command is idempotent and also works to approve an account that signed up
before approvals existed. Alternatively, sign in with the seeded admin account
and promote yourself from `/dashboard/admin` → **Make admin**.

---

## Features

### Assignments tracker
Kanban-style board with TODO / IN PROGRESS / DONE columns, priority badges,
subject chips, due-date awareness (Today, Tomorrow, Overdue), search, status
filters, and free-text search. Creating, editing, moving, and deleting are all
optimistic with rollback + toast on failure.

### GPA / grade calculator
Per-course weighted breakdowns out of 100%:

- **Current** — weighted average of graded assessments, renormalised by graded weight.
- **Projected** — assumes ungraded items land on your target.
- **Needed on remaining** — the score required on what's left to hit a target
  letter grade, with explicit "impossible" and "already reached" states, plus
  the remaining weight.
- Credit-weighted semester GPA on a 4.0 scale, letter bands, and a warning when
  assessment weights exceed 100%.

### Snippet manager
Saved code with syntax highlighting (lazy-loaded Prism), language picker, tags,
favourites, full-screen viewer, one-click copy, and search across title, language,
tags, and code. Highlights follow the active theme.

### Pomodoro
Deadline-based countdown (immune to drift and background-tab throttling),
25/5 default with configurable focus / short / long lengths, automatic long break
every fourth round, optional auto-start, Web Audio chime, settings saved to the
account (`User.pomodoroSettings`), and completed focus sessions logged to the
database with today's minute + session totals.

### Scratchpad
Markdown notes with 750 ms debounced autosave (flushed on unmount and note
switch via `keepalive`), GitHub-flavoured preview, pinning, word count, and
relative timestamps.

### Accounts & verification
Verified Google sign-ins using `@zewail.edu.eg` activate automatically;
password sign-ups wait for review. `/dashboard/admin` gives admins a searchable
account list with status + role filters and live counters
(accounts, pending, active, admins). From there an admin can:

- **Approve** a pending account (sets `ACTIVE`, stamps `approvedAt`).
- **Suspend / reactivate** an account without deleting its data.
- **Promote / demote** between student and admin.
- **Create an account** directly, already approved, with a temporary password.
- **Delete an account** and every row it owns (cascade).

Pending and suspended users can still sign in — they simply land on `/pending`
with a "Check again" button and a sign-out option, and every dashboard page and
API route redirects or returns 403 until the account is active. Role and status
are read from the database on each request rather than baked into the JWT, so an
approval or suspension takes effect immediately.

Guard rails: an admin cannot demote, suspend, or delete their own account, and the
last remaining active admin cannot be demoted, suspended, or deleted.

### Everything else
- Sign in / register / sign out, with inline field-level validation.
- Theme: light, dark, or follow the OS.
- Language: English ↔ العربية. The whole shell flips to RTL — the cookie is read
  during the root render so there's no flash of the wrong direction.
- Settings: rename your profile, switch theme/language, and manage your session.
- Role-aware navigation: the Administration group only appears for admins.

### Class alarms (Web Push)
The schedule page and settings have an **Enable reminders** toggle. It registers
`public/service-worker.js` (push-only; it does not cache pages), asks for
notification permission, subscribes with the VAPID public key, and stores the
endpoint in `push_subscriptions` (`PushSubscription`).

The GitHub Actions workflow `.github/workflows/push-reminders.yml` calls the
lecture and assignment reminder endpoints every five minutes. Class alerts are
sent one hour before each student's own scheduled class. Active students with
push enabled receive the app's shared First Year CS (CS-1) assignment alert one
day before its deadline; the app does not yet store each student's cohort.
delivery records prevent repeat alerts on later scheduler runs. Expired push
subscriptions are removed automatically.

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and
`CRON_SECRET` (see `.env.example`). Generate the key pair once with
`npx web-push generate-vapid-keys --json`; rotating it invalidates existing
subscriptions, so users toggle alarms on again. Push requires HTTPS outside
`localhost`.

For Vercel Hobby, add `CAMPUS_APP_URL` (the deployed site URL) and `CRON_SECRET`
as GitHub repository Actions secrets. Use the same `CRON_SECRET` in Vercel
Environment Variables. GitHub Actions runs every five minutes; GitHub may delay
scheduled runs, so delivery can be a few minutes late. This avoids requiring a
paid Vercel plan.

### Install Campus on a phone
Campus includes a web app manifest and service worker. On Android, use the
browser's **Install app** or **Add to Home Screen** option. On iPhone, open the
site in Safari, tap **Share**, then **Add to Home Screen**. Push alerts require
the user to enable them in **Settings**; on iPhone, install Campus to the Home
Screen before enabling notifications.

---

## Architecture

```
src/
├─ app/
│  ├─ (auth)/login, (auth)/register     Public auth pages
│  ├─ (app)/dashboard/…                 Authenticated shell + 8 pages
│  ├─ pending/                          Waiting room for unapproved accounts
│  └─ api/…                             REST route handlers
├─ auth.ts, auth.config.ts              Full auth vs. edge-safe slice
├─ middleware.ts                        Route gating (no Prisma, edge-safe)
├─ components/
│  ├─ ui/                               shadcn primitives
│  ├─ tasks/ gpa/ snippets/ pomodoro/   Feature clients (optimistic state)
│  ├─ notes/ settings/ admin/
│  └─ layout/                           Sidebar, topbar, theme + locale toggles
├─ i18n/                                config, provider, en.ts, ar.ts
└─ lib/                                 prisma, session + API guards, validations,
                                        serializers, GPA math, formatting
prisma/
├─ schema.prisma                        Models, enums, cascade FKs
├─ seed.ts                              Demo admin + students + realistic data
└─ promote-admin.ts                     Bootstrap/approve an admin by email
```

**Data flow.** Pages are Server Components: `requireUser()` resolves the session
and reads role/status from the database, Prisma fetches only that user's rows, and
serializers turn them into plain DTOs (`src/lib/types.ts`) that are handed to
client components. Mutations go through `/api/*` handlers that re-check the session
and re-scope every query — client components never touch Prisma and never receive
another tenant's data. Admin pages additionally call `requireAdmin()`; admin API
routes call `requireAdminUserId()` and re-verify role + status on every request.

**Auth shape.** `auth.config.ts` holds the edge-safe config (pages, JWT strategy,
authorized callback) because middleware runs on the Edge where Prisma can't load.
`auth.ts` spreads it and adds the Prisma adapter and the credentials provider,
which verifies passwords against a bcrypt hash on `User.passwordHash`.

---

## API

All endpoints require a session and operate exclusively on the caller's rows.
Unscoped IDs return **404**, not 403, so existence isn't leaked.

| Method | Endpoint                        | Purpose                          |
| ------ | ------------------------------- | -------------------------------- |
| `POST` | `/api/register`                 | Create an account (bcrypt hash)  |
| `GET/POST`  | `/api/tasks`                | List / create tasks              |
| `PATCH/DELETE` | `/api/tasks/[id]`        | Update / delete a task           |
| `GET/POST`  | `/api/courses`              | List / create courses            |
| `PATCH/DELETE` | `/api/courses/[id]`      | Update / delete a course         |
| `POST` | `/api/courses/[id]/assessments` | Add an assessment to a course    |
| `PATCH/DELETE` | `/api/assessments/[id]`  | Update / delete an assessment    |
| `GET/POST`  | `/api/snippets`             | List / create snippets           |
| `PATCH/DELETE` | `/api/snippets/[id]`     | Update / delete (incl. favourite)|
| `GET/POST`  | `/api/notes`                | List / create notes              |
| `PATCH/DELETE` | `/api/notes/[id]`        | Update (autosave) / delete       |
| `GET/POST`  | `/api/pomodoro`             | List / log focus sessions        |
| `PATCH` | `/api/profile`                 | Update display name / locale     |
| `GET/POST`  | `/api/admin/users`          | Admin: list (search/filter) / create accounts |
| `PATCH/DELETE` | `/api/admin/users/[id]`  | Admin: approve/suspend/promote/demote/delete  |
| `*`    | `/api/auth/[...nextauth]`       | Auth.js handlers                 |

Every payload is validated with Zod (`src/lib/validations/*`) before touching the
database; malformed input returns `400` with field-level issues.

Admin endpoints are restricted to active admins. They return `403` for non-admins
and for guard-rail violations — `SELF_ROLE`, `SELF_STATUS`, `SELF_DELETE`, or
`LAST_ADMIN` — and `409 EMAIL_TAKEN` when creating a duplicate account.

---

## Multi-tenancy

This is the property worth checking first if you're reviewing the code:

1. **Schema** — `Task`, `Course`, `Snippet`, `Note`, and `PomodoroSession` all carry
   a non-nullable `userId` with `onDelete: Cascade`. `Assessment` reaches the user
   through its `Course`, and every course mutation verifies ownership of the parent
   course first.
2. **Server guards** — each page calls `requireUser()`; each route handler calls
   `requireUserId()`. Both read the Auth.js session, never a client-supplied id,
   and both re-read the account from the database so a pending or suspended user
   is locked out immediately. Admin pages/routes use `requireAdmin()` and
   `requireAdminUserId()` on top of that.
3. **Scoped queries** — list queries filter by `userId`; single-row queries use
   `where: { id, userId }` (`updateMany`/`deleteMany` semantics or an ownership
   pre-check), so a guessed ID from another tenant matches nothing.
4. **No leakage into the client** — serializers emit an explicit allowlist of
   fields. Internal columns (`passwordHash`, foreign keys, adapter tables) are
   never sent to the browser.
5. **Admin boundary** — admin routes can see other accounts, but only through
   dedicated `/api/admin/*` endpoints that expose a whitelisted `AdminUserDTO`.

To verify by hand: register a second account, note that all pages render empty
states once approved, then try requesting one of the demo account's resource IDs
while signed in as the new user — the API returns 404. Try opening
`/dashboard/admin` as a non-admin — it redirects to the dashboard.

---

## Internationalisation

- `src/i18n/dictionaries/en.ts` is the source of truth; `ar.ts` is typed as
  `Dictionary`, so adding an English string without its Arabic counterpart is a
  **compile error**, not a fallback to `undefined`.
- The locale lives in the `sdd-locale` cookie. The root layout reads it and sets
  `lang` and `dir` on `<html>` during the server render, so RTL arrives with the
  first paint rather than snapping after hydration.
- Layout utilities are logical (`ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`),
  and code blocks are pinned `dir="ltr"` so code never mirrors.
- Numbers and dates use `Intl` with the active locale.

## Theming

`next-themes` flips a `class` on `<html>`; the palette is defined as OKLCH tokens in
`globals.css` with a dedicated dark block. Surfaces lean on translucent cards,
soft layered shadows, and generous radii for the glassmorphism look, with
`prefers-reduced-motion` respected for the motion layer.

---

## Verification

The repo was exercised end-to-end against a local PostgreSQL 18 instance:

- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
- `prisma db push` + `db:seed` run cleanly.
- Signed in as the demo admin, approved a pending account, suspended and
  reactivated a student, promoted/demoted, created and deleted an account, and
  confirmed the self-action guard rails (`403 SELF_ROLE` / `SELF_STATUS` /
  `SELF_DELETE`) plus duplicate-email handling (`409 EMAIL_TAKEN`).
- Verified campus Google accounts are approved automatically; password
  registrations stay pending for admin review.

---

## Features (added)

- **Syllabus tracker** — `/dashboard/syllabus`: per-course checklist with
  completion percentages, quick add, and an overall progress ring.
- **Developer utilities** — `/dashboard/utilities`: JSON formatter/minifier
  and a hex/binary/decimal base converter, fully client-side.
- **Shareable snippets** — public links at `/s/[slug]` with unguessable slugs,
  toggled via `POST/DELETE /api/snippets/[id]/share`.
- **Pomodoro analytics** — 14-day focus trend, streak, and best-day stats,
  plus ambient sounds (rain, ocean, brown, white) synthesized with the
  Web Audio API.
- **Project portfolio** — `/dashboard/projects`: featured projects with tech
  stack, status, dates, and links.

---

- **Campus account approval is automatic for verified Google sign-ins.**
  Password sign-ups wait for admin review. Set `ALLOWED_EMAIL_DOMAIN` to block
  all other domains.
- Seeded demo passwords exist for convenience — change or remove them before
  exposing the app publicly.
- No password reset or email-change flow yet (Google OAuth or a direct
  registration are the supported paths).
- Pomodoro settings, theme, language, the schedule and the clock format live on
  the account row (`User`), so they follow the user across devices; completed
  Pomodoro sessions are stored separately in `PomodoroSession`.
- Role and status are checked with one extra database read per page/API request.
  That is the price of immediate revocation over JWT-embedded claims; add a short
  cache if you need to shave latency.
- The GPA scale is a fixed 4.0 letter-grade mapping in `src/lib/gpa.ts`; adapt it
  there for your institution's bands.
