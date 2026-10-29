import type { Metadata } from "next";

import { isGoogleEnabled } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { LoginForm } from "./login-form";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.auth.signIn);
}

export default function LoginPage() {
  return <LoginForm googleEnabled={isGoogleEnabled} />;
}
