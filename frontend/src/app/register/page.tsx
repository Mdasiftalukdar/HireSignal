"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { ConsentNote } from "@/components/ConsentNote";
import { GoogleButton } from "@/components/GoogleButton";
import { Alert, Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Token {
  access_token: string;
}

type Step = "signup" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Support deep-links from the login page: /register?step=otp&email=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("email");
    if (e) setEmail(e);
    if (params.get("step") === "otp") {
      setStep("otp");
      setNotice("Your email needs verification. We sent a fresh code.");
    }
  }, []);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/register", {
        method: "POST",
        auth: false,
        body: { json: { email, password, full_name: fullName || null } },
      });
      setStep("otp");
      setNotice("We emailed you a 6-digit verification code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { access_token } = await api<Token>("/auth/verify-otp", {
        method: "POST",
        auth: false,
        body: { json: { email, code } },
      });
      await login(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    await api("/auth/resend-otp", {
      method: "POST",
      auth: false,
      body: { json: { email } },
    }).catch(() => {});
    setNotice("A new code is on its way.");
  }

  if (step === "otp") {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={`Enter the code we sent to ${email || "your inbox"}.`}
        footer={
          <button
            onClick={onResend}
            className="font-semibold text-[var(--color-primary)]"
          >
            Resend code
          </button>
        }
      >
        <form onSubmit={onVerify} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}
          <div>
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="tracking-[0.4em] text-center text-lg"
            />
          </div>
          <Button type="submit" className="w-full" loading={busy}>
            Verify &amp; continue
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start analyzing your résumé against real job posts."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--color-primary)]">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs font-medium text-[var(--color-subtle)]">OR</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <form onSubmit={onSignup} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
        <ConsentNote action="creating an account" />
      </form>
    </AuthShell>
  );
}
