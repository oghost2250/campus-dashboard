import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isGoogleEnabled } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.auth.signIn);
}

export default async function LoginPage() {
  // Middleware can only see the JWT. Verify the account still exists before
  // bouncing a signed-in visitor to the dashboard.
  const user = await getCurrentUser();
  if (user) {
    redirect(user.status === "ACTIVE" ? "/dashboard" : "/pending");
  }

  return <LoginForm googleEnabled={isGoogleEnabled} />;
}
