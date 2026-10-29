import "server-only";
import { z } from "zod";

/**
 * Fail fast on boot if a required secret is missing, instead of throwing a
 * cryptic error on the first request that needs it.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: z
    .string()
    .min(1)
    .default(() =>
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000",
    ),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .min(1)
    .default(() =>
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000",
    ),
  /** Optional campus domain, e.g. "zewailcity.edu.eg". Blank accepts any email. */
  ALLOWED_EMAIL_DOMAIN: z
    .string()
    .optional()
    .transform((value) => value?.trim().replace(/^@/, "").toLowerCase() || null),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

export const isGoogleEnabled = Boolean(
  env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET,
);
