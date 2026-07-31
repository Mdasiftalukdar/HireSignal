"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { ConsentNote } from "@/components/ConsentNote";
import { GoogleButton } from "@/components/GoogleButton";
import { Alert, Button, Input, Label } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Token {
  access_token: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { access_token } = await api<Token>("/auth/login", {
        method: "POST",
        auth: false,
        body: { form: { username: email, password } },
      });
      await login(access_token);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Email not verified - send a fresh code and jump to the OTP screen.
        await api("/auth/resend-otp", {
          method: "POST",
          auth: false,
          body: { json: { email } },
        }).catch(() => {});
        router.push(`/register?step=otp&email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to analyze resumes and track applications."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-[var(--color-primary)]">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign in with Google" />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Sign in
        </Button>
        <ConsentNote action="signing in" />
      </form>
    </AuthShell>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span className="text-xs font-medium text-[var(--color-subtle)]">OR</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}
