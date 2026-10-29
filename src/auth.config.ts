import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the auth config.
 *
 * `middleware.ts` runs on the Edge runtime where Prisma cannot run, so it
 * imports only this object. The full config in `src/auth.ts` spreads it and
 * adds the Prisma adapter + credential provider.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    /**
     * Runs in middleware. Returning false makes Auth.js redirect to `signIn`.
     *
     * Auth pages are always allowed through. They do their own database-backed
     * redirect when a *live* user is signed in. Redirecting from here on JWT
     * presence alone would trap accounts whose user row was deleted (e.g. by an
     * admin or a reseed): /login → /dashboard → /login, forever.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;

      const isAuthPage =
        pathname === "/login" || pathname === "/register";

      if (isAuthPage) {
        return true;
      }

      if (pathname.startsWith("/dashboard")) {
        return isLoggedIn;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
