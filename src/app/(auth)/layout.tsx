import type { ReactNode } from "react";

import { AuthShowcase } from "@/components/auth/auth-showcase";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <AuthShowcase />
      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
