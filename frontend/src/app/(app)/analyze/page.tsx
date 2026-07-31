"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnalysisResults } from "@/components/AnalysisResults";
import { Alert, Button, Card, Label, Select, Spinner, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Analysis, AnalysisSubmit, SavedResume } from "@/lib/types";

type ResumeMode = "saved" | "upload" | "paste";
type JobMode = "paste" | "upload";
type Phase = "form" | "processing" | "done";

export default function AnalyzePage() {
  const [saved, setSaved] = useState<SavedResume[]>([]);
  const [resumeMode, setResumeMode] = useState<ResumeMode>("saved");
  const [savedId, setSavedId] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");

  const [jobMode, setJobMode] = useState<JobMode>("paste");
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState("");

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<SavedResume[]>("/me/resumes")
      .then((rows) => {
        setSaved(rows);
        if (rows.length === 0) setResumeMode("paste");
        else setSavedId(String(rows[0].id));
      })
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("form");
    setResult(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    if (resumeMode === "saved") {
      if (!savedId) return setError("Pick a saved résumé, or choose upload/paste.");
      fd.append("saved_resume_id", savedId);
    } else if (resumeMode === "upload") {
      if (!resumeFile) return setError("Choose a résumé file, or switch mode.");
      fd.append("resume_file", resumeFile);
    } else {
      if (!resumeText.trim()) return setError("Paste your résumé, or switch mode.");
      fd.append("resume_text", resumeText);
    }

    if (jobMode === "upload") {
      if (!jobFile) return setError("Choose a job-description file, or paste it.");
      fd.append("job_file", jobFile);
    } else {
      if (jobText.trim().length < 20) return setError("Paste a fuller job description (20+ chars).");
      fd.append("job_text", jobText);
    }

    setPhase("processing");
    try {
      const submitRes = await api<AnalysisSubmit>("/ai/analyze", {
        method: "POST",
        body: { formData: fd },
      });
      poll(submitRes.analysis_id);
    } catch (err) {
      setPhase("form");
      if (err instanceof ApiError && err.status === 429) {
        setError(err.message); // daily free limit
      } else {
        setError(err instanceof Error ? err.message : "Failed to start analysis");
      }
    }
  }

  function poll(id: number) {
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const a = await api<Analysis>(`/ai/analyze/${id}`);
        if (a.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setResult(a);
          setPhase("done");
        } else if (a.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase("form");
          setError(a.error || "Analysis failed. Please try again.");
        } else if (Date.now() - started > 90_000) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase("form");
          setError("Analysis is taking unusually long. Please try again.");
        }
      } catch {
        /* transient — keep polling until timeout */
      }
    }, 2000);
  }

  if (phase === "processing") {
    return (
      <Centered>
        <Spinner className="size-8 text-[var(--color-primary)]" />
        <p className="text-lg font-semibold">Analyzing your résumé…</p>
        <p className="text-sm text-[var(--color-muted)]">
          Embedding, retrieving, and scoring against the job. This takes ~10–20 seconds.
        </p>
      </Centered>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your match report</h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              Analyze another
            </Button>
            <Link href="/tracker">
              <Button variant="ghost">View tracker</Button>
            </Link>
          </div>
        </div>
        <AnalysisResults a={result} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyze a résumé</h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Compare a résumé against a job description for an AI match report.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">1. Your résumé</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Toggle active={resumeMode === "saved"} onClick={() => setResumeMode("saved")} disabled={saved.length === 0}>
              Saved
            </Toggle>
            <Toggle active={resumeMode === "upload"} onClick={() => setResumeMode("upload")}>
              Upload
            </Toggle>
            <Toggle active={resumeMode === "paste"} onClick={() => setResumeMode("paste")}>
              Paste
            </Toggle>
          </div>

          <div className="mt-4">
            {resumeMode === "saved" &&
              (saved.length > 0 ? (
                <>
                  <Label htmlFor="saved">Choose a saved résumé</Label>
                  <Select id="saved" value={savedId} onChange={(e) => setSavedId(e.target.value)}>
                    {saved.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} ({r.filename})
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <p className="text-sm text-[var(--color-muted)]">
                  No saved résumés.{" "}
                  <Link href="/settings" className="font-semibold text-[var(--color-primary)]">
                    Add one
                  </Link>{" "}
                  or use Upload / Paste.
                </p>
              ))}
            {resumeMode === "upload" && (
              <FileInput id="resume-file" onChange={setResumeFile} />
            )}
            {resumeMode === "paste" && (
              <Textarea
                rows={7}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your résumé text…"
              />
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">2. Job description</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Toggle active={jobMode === "paste"} onClick={() => setJobMode("paste")}>
              Paste
            </Toggle>
            <Toggle active={jobMode === "upload"} onClick={() => setJobMode("upload")}>
              Upload
            </Toggle>
          </div>
          <div className="mt-4">
            {jobMode === "paste" ? (
              <Textarea
                rows={7}
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                placeholder="Paste the job description…"
              />
            ) : (
              <FileInput id="job-file" onChange={setJobFile} />
            )}
          </div>
        </Card>

        <Button type="submit" className="w-full">
          Analyze match
        </Button>
      </form>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? "rounded-lg bg-[var(--color-primary-soft)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-primary-hover)]"
          : "rounded-lg px-3.5 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

function FileInput({ id, onChange }: { id: string; onChange: (f: File | null) => void }) {
  return (
    <input
      id={id}
      type="file"
      accept=".pdf,.docx,.txt,.md"
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      className="block w-full text-sm text-[var(--color-muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary-soft)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-primary-hover)] hover:file:bg-indigo-100"
    />
  );
}
