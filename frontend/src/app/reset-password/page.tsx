"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Token {
  access_token: string;
}

type Step = "request" | "reset";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Allow deep-links from the login page: /reset-password?email=...
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("email");
    if (e) setEmail(e);
  }, []);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // The backend replies the same way whether or not the email exists, so we
      // always advance to the reset step and never reveal which emails have accounts.
      await api("/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { json: { email } },
      });
      setStep("reset");
      setNotice("If an account exists for that email, we sent a 6-digit reset code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a reset code");
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { access_token } = await api<Token>("/auth/reset-password", {
        method: "POST",
        auth: false,
        body: { json: { email, code, new_password: newPassword } },
      });
      await login(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    await api("/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: { json: { email } },
    }).catch(() => {});
    setNotice("A new code is on its way.");
  }

  if (step === "reset") {
    return (
      <AuthShell
        title="Choose a new password"
        subtitle={`Enter the code we sent to ${email || "your inbox"} and a new password.`}
        footer={
          <button
            onClick={onResend}
            className="font-semibold text-[var(--color-primary)]"
          >
            Resend code
          </button>
        }
      >
        <form onSubmit={onReset} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}
          <div>
            <Label htmlFor="code">Reset code</Label>
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
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <Button type="submit" className="w-full" loading={busy}>
            Reset password &amp; sign in
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a code to reset your password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-[var(--color-primary)]">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onRequest} className="space-y-4">
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
        <Button type="submit" className="w-full" loading={busy}>
          Send reset code
        </Button>
      </form>
    </AuthShell>
  );
}
