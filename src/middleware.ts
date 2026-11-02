import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const auth = NextAuth(authConfig).auth;

export default auth((request) => {
  // User-specific API payloads must never be cached by browsers or CDNs,
  // otherwise one account's data can leak to another on a shared device.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and the auth API itself.
     */
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};