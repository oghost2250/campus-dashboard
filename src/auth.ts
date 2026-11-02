import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { isGoogleEnabled } from "@/lib/env";
import { isAutomaticallyApprovedEmail } from "@/lib/account-approval";
import type { NextAuthConfig } from "next-auth";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          passwordHash: true,
        },
      });

      // Same generic failure for "no user" and "wrong password" so the endpoint
      // cannot be used to enumerate accounts.
      if (!user?.passwordHash) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
];

if (isGoogleEnabled) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Safe here: Google verifies the email, and the account is only linked
      // when the address matches an existing verified user.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    // Keep the JWT session usable after a user record is removed.
    async signIn({ user, account, profile }) {
      if (user?.id) {
        if (
          isAutomaticallyApprovedEmail(
            user.email,
            account?.provider,
            account?.provider === "google" && profile?.email_verified === true,
          )
        ) {
          // Only Google-verified campus addresses can self-activate. Never
          // reactivate suspended accounts.
          await prisma.user.updateMany({
            where: { id: user.id, status: "PENDING" },
            data: { status: "ACTIVE", approvedAt: new Date() },
          }).catch(() => undefined);
        }
        await prisma.user
          .update({
            where: { id: user.id },
            data: { updatedAt: new Date() },
          })
          .catch(() => undefined);
      }
    },
  },
});
