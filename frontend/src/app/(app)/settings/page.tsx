"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SavedResume, SavedResumeDetail, Usage } from "@/lib/types";

const PROVIDERS: { value: string; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google", label: "Google (Gemini)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "groq", label: "Groq" },
  { value: "mistral", label: "Mistral" },
  { value: "together", label: "Together AI" },
  { value: "xai", label: "xAI (Grok)" },
  { value: "perplexity", label: "Perplexity" },
];
const MAX_SAVED = 5;

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Settings</h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Bring your own LLM key for unlimited checks, and manage saved resumes.
        </p>
      </div>
      <ApiKeyCard />
      <SavedResumesCard />
    </div>
  );
}

/* ---------------- Bring-your-own API key ---------------- */

function ApiKeyCard() {
  const { refresh } = useAuth();
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("openrouter");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function load() {
    const usage = await api<Usage>("/me/usage");
    setHasKey(usage.has_api_key);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api("/me/api-key", {
        method: "PUT",
        body: { json: { api_key: key.trim(), provider } },
      });
      setKey("");
      setMsg({ tone: "success", text: "API key saved. You now have unlimited checks." });
      await load();
      await refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof Error ? err.message : "Failed to save key" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setMsg(null);
    setBusy(true);
    try {
      await api("/me/api-key", { method: "DELETE" });
      setMsg({ tone: "success", text: "API key removed. Back to the free daily limit." });
      await load();
      await refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof Error ? err.message : "Failed to remove key" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">LLM API key</h2>
        {hasKey ? <Badge tone="success">Key set · unlimited</Badge> : <Badge>Free · 2/day</Badge>}
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Your key is <strong>encrypted at rest</strong> and only used to run your own analyses.
      </p>

      {loading ? (
        <div className="py-6">
          <Spinner className="size-5 text-[var(--color-primary)]" />
        </div>
      ) : (
        <>
          {msg && (
            <div className="mt-4">
              <Alert tone={msg.tone}>{msg.text}</Alert>
            </div>
          )}
          <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="key">{hasKey ? "Replace key" : "API key"}</Label>
              <Input
                id="key"
                type="password"
                autoComplete="off"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-… / your provider key"
              />
            </div>
            <Button type="submit" loading={busy}>
              {hasKey ? "Update" : "Save key"}
            </Button>
          </form>

          {hasKey && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <Button variant="danger" onClick={remove} loading={busy}>
                Remove key
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------------- Saved resumes (≤3, labeled) ---------------- */

function SavedResumesCard() {
  const [resumes, setResumes] = useState<SavedResume[] | null>(null);
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SavedResumeDetail | null>(null);
  const [viewBusy, setViewBusy] = useState(false);

  async function load() {
    setResumes(await api<SavedResume[]>("/me/resumes"));
  }
  useEffect(() => {
    load();
  }, []);

  async function view(id: number) {
    setError(null);
    setViewBusy(true);
    setViewing(null);
    try {
      setViewing(await api<SavedResumeDetail>(`/me/resumes/${id}`));
    } catch {
      setError("Couldn't load that resume.");
    } finally {
      setViewBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "file" && !file) {
      setError("Choose a file, or switch to paste.");
      return;
    }
    if (mode === "text" && !text.trim()) {
      setError("Paste your resume text, or switch to file.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("label", label);
      if (mode === "file" && file) fd.append("file", file);
      if (mode === "text") fd.append("text", text);
      await api("/me/resumes", { method: "POST", body: { formData: fd } });
      setLabel("");
      setFile(null);
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save resume");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: number, label: string | null) {
    if (!confirm(`Delete the saved resume "${label ?? "this resume"}"? This can't be undone.`)) return;
    setError(null);
    try {
      await api(`/me/resumes/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resume");
    }
  }

  const count = resumes?.length ?? 0;
  const atCap = count >= MAX_SAVED;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved resumes</h2>
        <Badge tone={atCap ? "warning" : "neutral"}>
          {count} / {MAX_SAVED}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Keep up to {MAX_SAVED} labeled resumes to reuse in the Analyze flow.
      </p>

      {resumes === null ? (
        <div className="py-6">
          <Spinner className="size-5 text-[var(--color-primary)]" />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {resumes.length === 0 && (
            <li className="py-4 text-sm text-[var(--color-subtle)]">No saved resumes yet.</li>
          )}
          {resumes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-3">
              <button
                onClick={() => view(r.id)}
                className="min-w-0 flex-1 text-left"
                title="View this resume"
              >
                <p className="truncate font-medium text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
                  {r.label}
                </p>
                <p className="truncate text-xs text-[var(--color-subtle)]">{r.filename}</p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" onClick={() => view(r.id)}>
                  View
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => del(r.id, r.label)}
                  className="text-[var(--color-danger)]"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!atCap && (
        <form onSubmit={add} className="mt-5 space-y-4 border-t border-[var(--color-border)] pt-5">
          <h3 className="text-sm font-semibold">Add a resume</h3>
          {error && <Alert>{error}</Alert>}
          <div>
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              required
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Backend Engineer - 2026"
            />
          </div>
          <div className="flex gap-2">
            <ModeToggle active={mode === "file"} onClick={() => setMode("file")}>
              Upload file
            </ModeToggle>
            <ModeToggle active={mode === "text"} onClick={() => setMode("text")}>
              Paste text
            </ModeToggle>
          </div>
          {mode === "file" ? (
            <div>
              <Label htmlFor="file">Resume file (PDF, DOCX, TXT)</Label>
              <input
                id="file"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[var(--color-muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary-soft)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-primary-hover)] hover:file:bg-indigo-100"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="text">Resume text</Label>
              <Textarea
                id="text"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your resume here…"
              />
            </div>
          )}
          <Button type="submit" loading={busy}>
            Save resume
          </Button>
        </form>
      )}

      {(viewBusy || viewing) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{viewing?.label ?? "Resume"}</p>
                {viewing?.filename && (
                  <p className="truncate text-xs text-[var(--color-subtle)]">{viewing.filename}</p>
                )}
              </div>
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {viewBusy ? (
                <div className="flex justify-center py-10">
                  <Spinner className="size-6 text-[var(--color-primary)]" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-[var(--color-foreground)]">
                  {viewing?.content_text || "No text stored for this resume."}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ModeToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-[var(--color-primary-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary-hover)]"
          : "rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-slate-100"
      }
    >
      {children}
    </button>
  );
}
