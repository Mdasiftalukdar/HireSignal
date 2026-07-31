"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Usage } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Usage>("/me/usage")
      .then(setUsage)
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Here&apos;s your résumé-analysis activity at a glance.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-[var(--color-primary)]" />
        </div>
      ) : usage ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Checks today"
              value={
                usage.unlimited ? String(usage.today) : `${usage.today} / ${usage.daily_limit}`
              }
              hint={usage.unlimited ? "Unlimited (your API key)" : "Free daily limit"}
            />
            <StatCard label="Total analyses" value={String(usage.total)} hint="All time" />
            <StatCard
              label="Plan"
              value={usage.unlimited ? "Unlimited" : "Free"}
              badge={
                usage.has_api_key ? (
                  <Badge tone="success">API key set</Badge>
                ) : (
                  <Badge tone="neutral">No key</Badge>
                )
              }
              hint={usage.has_api_key ? "Using your own LLM key" : "Add a key for unlimited checks"}
            />
          </div>

          {!usage.unlimited && usage.today >= usage.daily_limit && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                You&apos;ve hit today&apos;s free limit.{" "}
                <Link href="/settings" className="font-semibold underline">
                  Add your own API key
                </Link>{" "}
                for unlimited checks.
              </p>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Jump straight into the tools.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/analyze">
                <Button>Analyze a résumé</Button>
              </Link>
              <Link href="/tracker">
                <Button variant="secondary">View application tracker</Button>
              </Link>
              <Link href="/settings">
                <Button variant="secondary">Manage saved résumés</Button>
              </Link>
            </div>
          </Card>
        </>
      ) : (
        <p className="text-[var(--color-muted)]">Couldn&apos;t load your usage.</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
        {badge}
      </div>
      <p className="mt-2 text-3xl font-bold text-[var(--color-foreground)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-subtle)]">{hint}</p>}
    </Card>
  );
}
