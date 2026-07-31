"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { Brand } from "@/components/Brand";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/*
  Guard for every authenticated route. Because auth state lives client-side
  (JWT in localStorage), we gate here rather than in server middleware: wait for
  the user to resolve, bounce to /login if there isn't one, otherwise render the
  app chrome. Unbuilt sections still route correctly through this shell.
*/
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <Brand />
        <Spinner className="size-5 text-[var(--color-primary)]" />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
