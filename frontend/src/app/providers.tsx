"use client";

import { AuthProvider } from "@/lib/auth";
import type { ReactNode } from "react";

/** Client-side context providers, mounted once at the root. */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
