"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Alert, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/*
  Landing spot for the Google OAuth redirect. The backend sends the JWT in the
  URL fragment (#token=...), which the browser keeps client-side and never sends
  to a server. We read it, hand it to the auth context, and move on.
*/
export default function GoogleCallbackPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const token = new URLSearchParams(hash).get("token");
    if (!token) {
      setError("No sign-in token was returned. Please try again.");
      return;
    }
    login(token).then(() => router.replace("/dashboard"));
  }, [login, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Brand />
      {error ? (
        <div className="max-w-sm">
          <Alert>{error}</Alert>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[var(--color-muted)]">
          <Spinner className="size-5 text-[var(--color-primary)]" />
          Signing you in…
        </div>
      )}
    </main>
  );
}
