import type { Metadata } from "next";

import { isGoogleEnabled } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { RegisterForm } from "./register-form";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.auth.signUp);
}

export default function RegisterPage() {
  return <RegisterForm googleEnabled={isGoogleEnabled} />;
}
