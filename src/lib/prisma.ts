import { PrismaClient } from "@prisma/client";

/**
 * Neon/pgBouncer tuning.
 *
 * On Vercel every concurrent request may spin up a separate function instance.
 * Without pool limits each instance opens its own set of connections and the
 * database runs out of slots long before we reach a few hundred students.
 * When a pooled Neon host is used we switch Prisma into PgBouncer mode and cap
 * the per-instance pool.
 */
function withPooling(raw: string | undefined): string | undefined {
  if (!raw) return raw;

  try {
    const url = new URL(raw);
    const pooledHost = url.hostname.includes("-pooler");
    const serverless =
      Boolean(process.env.VERCEL) || process.env.NEXT_RUNTIME === "edge";

    if (pooledHost && serverless) {
      if (!url.searchParams.has("pgbouncer")) {
        url.searchParams.set("pgbouncer", "true");
      }
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set(
          "connection_limit",
          process.env.PRISMA_CONNECTION_LIMIT ?? "5",
        );
      }
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "20");
      }
    }

    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Next.js dev server hot-reloads modules; without a global cache every reload
 * would open a new pool and exhaust Postgres connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withPooling(process.env.DATABASE_URL),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
