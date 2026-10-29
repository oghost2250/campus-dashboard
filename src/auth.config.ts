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
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;

      const isAuthPage =
        pathname === "/login" || pathname === "/register";

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (pathname.startsWith("/dashboard")) {
        return isLoggedIn;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
