# Scaling to 1,000+ students

This project is tuned for a single-campus deployment of roughly 1,000–5,000
students on Vercel + Neon Postgres.

## Database connections

- Use the Neon **pooled** host (`...-pooler...`) for `DATABASE_URL`.
- Use the **direct** host for `DIRECT_URL` (migrations / `prisma db push`).
- Do **not** add `channel_binding=require` to Prisma URLs — Prisma's pooled
  connections fail with it on Neon.
- On Vercel, `src/lib/prisma.ts` adds `pgbouncer=true`, `connection_limit=5`
  and `pool_timeout=20` automatically. Override with `PRISMA_CONNECTION_LIMIT`.
- One Prisma client per process is reused across hot reloads and requests.

## Query patterns

- Every API list endpoint is paginated (`limit`/`offset`, `page`/`pageSize`)
  and caps the page size server-side.
- The shared CS-1 assignment feed uses a composite index
  `(cohort, isActive, dueDate)` and returns at most 200 cards per request.
- The admin directory loads 100 accounts per page with a "Load more" button
  instead of transferring every user row.
- User status checks are cached in-process for 15 seconds and invalidated when
  an admin approves, suspends, or deletes an account.
- Creating batch assignments is capped at 10 per 10 minutes and 50 per day per
  user. Registration is capped at 5 attempts per IP per 10 minutes.

## Browser storage

- Study Hub materials and assignment backups use IndexedDB (larger quota,
  non-blocking) with automatic migration from the old localStorage payload.
- Captured/uploaded pages are downscaled to 1600 px JPEG before storage and PDF
  compilation; submissions are capped at 25 pages and ~3 MB of PDF data.

## Operations

- `GET /api/health` returns database latency (200 = ready, 503 = degraded).
- Neon autoscaling handles read load; keep a read replica for reporting if the
  admin dashboard is used heavily during registration week.
- Run `prisma db push` (or `prisma migrate deploy`) during deploy; never run it
  against the pooled URL.
