"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Root: send signed-in users to the dashboard, everyone else to login. */
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <Brand />
      <Spinner className="size-5 text-[var(--color-primary)]" />
    </main>
  );
}
