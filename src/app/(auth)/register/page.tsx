import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isGoogleEnabled } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.auth.signUp);
}

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.status === "ACTIVE" ? "/dashboard" : "/pending");
  }

  return <RegisterForm googleEnabled={isGoogleEnabled} />;
}
