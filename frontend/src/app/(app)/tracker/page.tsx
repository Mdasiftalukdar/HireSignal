"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Analysis, Decision, TrackerItem } from "@/lib/types";

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "under_review", label: "Under review" },
  { value: "selected", label: "Selected" },
  { value: "not_selected", label: "Not selected" },
];

export default function TrackerPage() {
  const [items, setItems] = useState<TrackerItem[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Analysis>>({});

  useEffect(() => {
    api<TrackerItem[]>("/me/analyses").then(setItems).catch(() => setItems([]));
  }, []);

  // Optimistically patch a row, then persist. Roll back on failure.
  async function patch(id: number, change: Partial<Pick<TrackerItem, "applied" | "decision">>) {
    setItems((cur) => cur?.map((it) => (it.id === id ? { ...it, ...change } : it)) ?? cur);
    try {
      await api(`/me/analyses/${id}`, { method: "PATCH", body: { json: change } });
    } catch {
      const fresh = await api<TrackerItem[]>("/me/analyses").catch(() => null);
      if (fresh) setItems(fresh);
    }
  }

  async function del(id: number) {
    if (!confirm("Delete this analysis from your tracker? This can't be undone.")) return;
    if (open === id) setOpen(null);
    setItems((cur) => cur?.filter((it) => it.id !== id) ?? cur); // optimistic
    try {
      await api(`/me/analyses/${id}`, { method: "DELETE" });
    } catch {
      const fresh = await api<TrackerItem[]>("/me/analyses").catch(() => null);
      if (fresh) setItems(fresh);
    }
  }

  // Expand a row and lazy-load its full report (missing skills + bullets).
  async function toggle(id: number) {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (!details[id]) {
      try {
        const full = await api<Analysis>(`/ai/analyze/${id}`);
        setDetails((d) => ({ ...d, [id]: full }));
      } catch {
        /* leave it; the panel shows a spinner */
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Application tracker</h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Every analysis you&apos;ve run. Click a row to see its skill gaps and suggested bullets.
          </p>
        </div>
        <Link href="/analyze">
          <Button>New analysis</Button>
        </Link>
      </div>

      {items === null ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-[var(--color-primary)]" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-[var(--color-muted)]">No analyses yet.</p>
          <Link href="/analyze" className="mt-2 inline-block font-semibold text-[var(--color-primary)]">
            Run your first analysis →
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50 text-left text-xs uppercase tracking-wide text-[var(--color-subtle)]">
                  <Th></Th>
                  <Th>Date</Th>
                  <Th>Score</Th>
                  <Th>Role</Th>
                  <Th>Resume</Th>
                  <Th>Applied</Th>
                  <Th>Outcome</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {items.map((it) => {
                  const expandable = it.status === "completed";
                  const isOpen = open === it.id;
                  return (
                    <Fragment key={it.id}>
                      <tr className="align-top">
                        <Td>
                          {expandable && (
                            <button
                              onClick={() => toggle(it.id)}
                              title={isOpen ? "Hide details" : "Show details"}
                              className="flex size-6 items-center justify-center rounded text-[var(--color-muted)] hover:bg-slate-100"
                            >
                              {isOpen ? "▾" : "▸"}
                            </button>
                          )}
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap text-[var(--color-muted)]">
                            {new Date(it.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </Td>
                        <Td>
                          {it.status !== "completed" ? (
                            <Badge tone={it.status === "failed" ? "danger" : "neutral"}>{it.status}</Badge>
                          ) : (
                            <ScorePill score={it.match_score ?? 0} />
                          )}
                        </Td>
                        <Td>
                          <p className="max-w-[280px] text-[var(--color-foreground)]">
                            {it.job_summary || <span className="text-[var(--color-subtle)]">-</span>}
                          </p>
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap">
                            {it.resume_label || (
                              <span className="text-[var(--color-subtle)]">on-the-fly</span>
                            )}
                          </span>
                        </Td>
                        <Td>
                          <button
                            onClick={() => patch(it.id, { applied: !it.applied })}
                            className={
                              it.applied
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200"
                            }
                          >
                            {it.applied ? "Applied ✓" : "Mark applied"}
                          </button>
                        </Td>
                        <Td>
                          <select
                            value={it.decision ?? ""}
                            onChange={(e) => patch(it.id, { decision: e.target.value as Decision })}
                            className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs focus:border-[var(--color-primary)] focus:outline-none"
                          >
                            <option value="" disabled>
                              Set outcome…
                            </option>
                            {DECISIONS.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </Td>
                        <Td>
                          <button
                            onClick={() => del(it.id)}
                            title="Delete this analysis"
                            className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--color-danger)] hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </Td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} className="border-t border-[var(--color-border)] bg-slate-50 px-6 py-4">
                            <Detail a={details[it.id]} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({ a }: { a: Analysis | undefined }) {
  if (!a) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="size-5 text-[var(--color-primary)]" />
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtle)]">
          Missing skills
        </p>
        {a.missing_skills && a.missing_skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {a.missing_skills.map((s, i) => (
              <Badge key={i} tone="danger">
                {s}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-subtle)]">Nothing major missing 🎉</p>
        )}
        {a.matched_skills && a.matched_skills.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtle)]">
              Matched skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {a.matched_skills.map((s, i) => (
                <Badge key={i} tone="success">
                  {s}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtle)]">
          Suggested bullets
        </p>
        {a.suggested_bullets && a.suggested_bullets.length > 0 ? (
          <ul className="space-y-1.5">
            {a.suggested_bullets.map((b, i) => (
              <li key={i} className="rounded-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-subtle)]">-</p>
        )}
        <Link
          href="/editor"
          className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          Add these in the Resume editor →
        </Link>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "success" : score >= 50 ? "warning" : "danger";
  return <Badge tone={tone}>{score}</Badge>;
}
