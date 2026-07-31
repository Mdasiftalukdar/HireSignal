"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import type { Analysis } from "@/lib/types";

/** Full AI match report rendering, reused by Analyze and the tracker detail. */
export function AnalysisResults({ a }: { a: Analysis }) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={a.match_score ?? 0} />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Match summary</h2>
            {a.recommendation && (
              <p className="mt-1 text-sm text-[var(--color-muted)]">{a.recommendation}</p>
            )}
          </div>
        </div>
      </Card>

      {(a.resume_summary || a.job_summary) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {a.resume_summary && <SummaryCard title="Your resume" body={a.resume_summary} />}
          {a.job_summary && <SummaryCard title="The role" body={a.job_summary} />}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ChipsCard title="Matched skills" items={a.matched_skills} tone="success" empty="No clear matches found." />
        <ChipsCard title="Missing skills" items={a.missing_skills} tone="danger" empty="Nothing major missing 🎉" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChipsCard title="Keywords present" items={a.keyword_matches} tone="success" empty="-" />
        <ChipsCard title="Keyword gaps" items={a.keyword_gaps} tone="warning" empty="-" />
      </div>

      <ListCard title="Section-by-section fixes" items={a.section_suggestions} />
      <ListCard title="Weaknesses for this role" items={a.weaknesses} />
      <BulletsCard items={a.suggested_bullets} />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color =
    pct >= 75 ? "var(--color-success)" : pct >= 50 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 110 110" className="size-28 -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-border)" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--color-foreground)]">{pct}</span>
        <span className="text-xs text-[var(--color-subtle)]">/ 100</span>
      </div>
    </div>
  );
}

function SummaryCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-[var(--color-muted)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-foreground)]">{body}</p>
    </Card>
  );
}

function ChipsCard({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[] | null;
  tone: "success" | "danger" | "warning";
  empty: string;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items && items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((s, i) => (
            <Badge key={i} tone={tone}>
              {s}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-subtle)]">{empty}</p>
      )}
    </Card>
  );
}

function ListCard({ title, items }: { title: string; items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <Card className="p-6">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-[var(--color-foreground)]">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BulletsCard({ items }: { items: string[] | null }) {
  const [copied, setCopied] = useState<number | null>(null);
  if (!items || items.length === 0) return null;

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked - ignore */
    }
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 text-base font-semibold">Ready-to-paste resume bullets</h3>
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        Tailored to weave in the target skills. Click to copy.
      </p>
      <ul className="space-y-2.5">
        {items.map((s, i) => (
          <li
            key={i}
            className="group flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-slate-50 px-4 py-3"
          >
            <span className="text-sm text-[var(--color-foreground)]">{s}</span>
            <button
              onClick={() => copy(s, i)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
            >
              {copied === i ? "Copied!" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
