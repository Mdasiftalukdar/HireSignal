"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Select, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportDocx, exportPdf } from "@/lib/resume-export";
import {
  contactLine,
  defaultResume,
  importResume,
  loadResume,
  loadServerResume,
  newEntry,
  newSection,
  normalizeResume,
  saveResume,
  saveServerResume,
  type ResumeDoc,
  type ResumeEntry,
  type ResumeSection,
} from "@/lib/resume-doc";
import type { Analysis, SavedResume, TrackerItem } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function EditorPage() {
  const { user } = useAuth();
  const [doc, setDoc] = useState<ResumeDoc | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const lastSavedRef = useRef<string>("");
  const hydratedRef = useRef(false);

  // Hydrate once: prefer the server copy, fall back to localStorage, then a template.
  useEffect(() => {
    if (hydratedRef.current) return;
    let cancelled = false;
    (async () => {
      let initial: ResumeDoc | null = null;
      try {
        initial = await loadServerResume();
      } catch {
        /* offline / transient - fall back to the local copy */
      }
      if (cancelled) return;
      const raw = initial ?? loadResume() ?? defaultResume(user?.full_name ?? "", user?.email ?? "");
      const d = normalizeResume(raw, user?.full_name ?? "", user?.email ?? "");
      lastSavedRef.current = JSON.stringify(d);
      hydratedRef.current = true;
      setDoc(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Cache to localStorage instantly; debounce-save to the server when it changed.
  useEffect(() => {
    if (!doc || !hydratedRef.current) return;
    saveResume(doc);
    const json = JSON.stringify(doc);
    if (json === lastSavedRef.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await saveServerResume(doc);
        lastSavedRef.current = json;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [doc]);

  if (!doc) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6 text-[var(--color-primary)]" />
      </div>
    );
  }

  // ---- immutable update helpers ----
  const set = (patch: Partial<ResumeDoc>) => setDoc((d) => (d ? { ...d, ...patch } : d));
  const mapSections = (fn: (s: ResumeSection) => ResumeSection) =>
    setDoc((d) => (d ? { ...d, sections: d.sections.map(fn) } : d));
  const patchSection = (sid: string, patch: Partial<ResumeSection>) =>
    mapSections((s) => (s.id === sid ? { ...s, ...patch } : s));
  const patchEntry = (sid: string, eid: string, patch: Partial<ResumeEntry>) =>
    mapSections((s) =>
      s.id === sid
        ? { ...s, entries: s.entries.map((e) => (e.id === eid ? { ...e, ...patch } : e)) }
        : s,
    );

  const moveSection = (sid: string, dir: -1 | 1) =>
    setDoc((d) => {
      if (!d) return d;
      const i = d.sections.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.sections.length) return d;
      const next = [...d.sections];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, sections: next };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Resume editor</h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Edit on the left, preview live on the right, export a real PDF or DOCX. Auto-saved to your account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={saveState} />
          <Button variant="secondary" onClick={() => exportDocx(doc)}>
            Export DOCX
          </Button>
          <Button onClick={() => exportPdf(doc)}>Export PDF</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* -------- Editor -------- */}
        <div className="space-y-5">
          <ImportResume onImport={(d) => setDoc(d)} />

          <AiSuggestions
            onAdd={(bullet, sid) =>
              mapSections((s) => {
                if (s.id !== sid) return s;
                const entries = s.entries.length ? s.entries : [newEntry()];
                const [first, ...rest] = entries;
                return { ...s, entries: [{ ...first, bullets: [...first.bullets, bullet] }, ...rest] };
              })
            }
            sections={doc.sections}
          />

          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-subtle)]">
              Header
            </h2>
            <Field label="Full name" value={doc.fullName} onChange={(v) => set({ fullName: v })} />
            <Field label="Headline" value={doc.headline} onChange={(v) => set({ headline: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={doc.email} onChange={(v) => set({ email: v })} />
              <Field label="Phone" value={doc.phone} onChange={(v) => set({ phone: v })} />
              <Field label="Location" value={doc.location} onChange={(v) => set({ location: v })} />
              <Field label="Website" value={doc.website} onChange={(v) => set({ website: v })} />
            </div>
            <FieldArea label="Summary" value={doc.summary} onChange={(v) => set({ summary: v })} />
          </Card>

          {doc.sections.map((section, si) => (
            <Card key={section.id} className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <input
                  value={section.heading}
                  onChange={(e) => patchSection(section.id, { heading: e.target.value })}
                  className="flex-1 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-sm font-semibold uppercase tracking-wide focus:border-[var(--color-border)] focus:bg-white focus:outline-none"
                />
                <IconBtn title="Move up" disabled={si === 0} onClick={() => moveSection(section.id, -1)}>
                  ↑
                </IconBtn>
                <IconBtn
                  title="Move down"
                  disabled={si === doc.sections.length - 1}
                  onClick={() => moveSection(section.id, 1)}
                >
                  ↓
                </IconBtn>
                <IconBtn
                  title="Delete section"
                  danger
                  onClick={() =>
                    set({ sections: doc.sections.filter((s) => s.id !== section.id) })
                  }
                >
                  ✕
                </IconBtn>
              </div>

              {section.entries.map((entry) => (
                <div key={entry.id} className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <MiniInput
                      placeholder="Title (role / degree)"
                      value={entry.title}
                      onChange={(v) => patchEntry(section.id, entry.id, { title: v })}
                    />
                    <MiniInput
                      placeholder="Dates · location"
                      value={entry.meta}
                      onChange={(v) => patchEntry(section.id, entry.id, { meta: v })}
                    />
                  </div>
                  <MiniInput
                    placeholder="Subtitle (company / school)"
                    value={entry.subtitle}
                    onChange={(v) => patchEntry(section.id, entry.id, { subtitle: v })}
                  />
                  {entry.bullets.map((b, bi) => (
                    <div key={bi} className="flex items-start gap-2">
                      <span className="mt-2.5 text-[var(--color-primary)]">•</span>
                      <textarea
                        rows={1}
                        value={b}
                        onChange={(e) => {
                          const bullets = [...entry.bullets];
                          bullets[bi] = e.target.value;
                          patchEntry(section.id, entry.id, { bullets });
                        }}
                        className="flex-1 resize-y rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                      />
                      <IconBtn
                        title="Remove bullet"
                        danger
                        onClick={() =>
                          patchEntry(section.id, entry.id, {
                            bullets: entry.bullets.filter((_, i) => i !== bi),
                          })
                        }
                      >
                        ✕
                      </IconBtn>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <button
                      onClick={() =>
                        patchEntry(section.id, entry.id, { bullets: [...entry.bullets, ""] })
                      }
                      className="text-xs font-semibold text-[var(--color-primary)]"
                    >
                      + Bullet
                    </button>
                    <button
                      onClick={() =>
                        patchSection(section.id, {
                          entries: section.entries.filter((e) => e.id !== entry.id),
                        })
                      }
                      className="text-xs font-medium text-[var(--color-danger)]"
                    >
                      Remove entry
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => patchSection(section.id, { entries: [...section.entries, newEntry()] })}
                className="text-sm font-semibold text-[var(--color-primary)]"
              >
                + Add entry
              </button>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => set({ sections: [...doc.sections, newSection()] })}
            >
              + Add section
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Reset the resume to the starter template? This clears your edits."))
                  setDoc(defaultResume(user?.full_name ?? "", user?.email ?? ""));
              }}
            >
              Reset to template
            </Button>
          </div>
        </div>

        {/* -------- Live A4 preview -------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <A4Preview doc={doc} />
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map: Record<Exclude<SaveState, "idle">, { text: string; cls: string }> = {
    saving: { text: "Saving…", cls: "text-[var(--color-subtle)]" },
    saved: { text: "Saved to your account", cls: "text-[var(--color-success)]" },
    error: { text: "Saved locally (offline)", cls: "text-[var(--color-warning)]" },
  };
  const { text, cls } = map[state];
  return <span className={`text-xs font-medium ${cls}`}>{text}</span>;
}

/* ---------------- Live preview (mirrors the exported layout) ---------------- */

function A4Preview({ doc }: { doc: ResumeDoc }) {
  const contact = contactLine(doc);
  return (
    <div className="mx-auto w-full max-w-[620px] rounded-lg border border-[var(--color-border)] bg-white p-10 shadow-sm">
      <h2 className="text-2xl font-bold text-[var(--color-foreground)]">
        {doc.fullName || "Your Name"}
      </h2>
      {doc.headline && (
        <p className="mt-0.5 text-sm font-medium text-[var(--color-primary)]">{doc.headline}</p>
      )}
      {contact && <p className="mt-1 text-xs text-[var(--color-muted)]">{contact}</p>}
      <div className="mt-3 border-b border-[var(--color-border)]" />
      {doc.summary.trim() && (
        <p className="mt-3 text-[13px] leading-relaxed text-slate-700">{doc.summary}</p>
      )}

      {doc.sections.map((s) => (
        <section key={s.id} className="mt-5">
          <h3 className="border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-foreground)]">
            {s.heading}
          </h3>
          <div className="mt-2 space-y-3">
            {s.entries.map((e) => (
              <div key={e.id}>
                {(e.title || e.meta) && (
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold text-[var(--color-foreground)]">
                      {e.title}
                    </span>
                    {e.meta && <span className="text-[11px] text-[var(--color-muted)]">{e.meta}</span>}
                  </div>
                )}
                {e.subtitle && (
                  <p className="text-[12px] italic text-slate-600">{e.subtitle}</p>
                )}
                {e.bullets.filter((b) => b.trim()).length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {e.bullets
                      .filter((b) => b.trim())
                      .map((b, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-slate-700">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-primary)]" />
                          <span>{b}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Import an existing resume ---------------- */

function ImportResume({ onImport }: { onImport: (d: ResumeDoc) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"saved" | "upload" | "paste">("saved");
  const [saved, setSaved] = useState<SavedResume[]>([]);
  const [savedId, setSavedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api<SavedResume[]>("/me/resumes")
      .then((rows) => {
        setSaved(rows);
        if (rows.length) setSavedId(String(rows[0].id));
        else setMode("upload");
      })
      .catch(() => {});
  }, [open]);

  async function run() {
    setError(null);
    const fd = new FormData();
    if (mode === "saved") {
      if (!savedId) return setError("Pick a saved resume, or upload/paste one.");
      fd.append("saved_resume_id", savedId);
    } else if (mode === "upload") {
      if (!file) return setError("Choose a resume file (PDF, DOCX, or TXT).");
      fd.append("resume_file", file);
    } else {
      if (text.trim().length < 30) return setError("Paste a bit more resume text.");
      fd.append("resume_text", text);
    }
    if (!confirm("Importing will replace the current editor content. Continue?")) return;
    setBusy(true);
    try {
      const doc = await importResume(fd);
      onImport(doc);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Import a resume</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Start from an existing resume - AI structures it into editable sections.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Import"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <ModeChip active={mode === "saved"} onClick={() => setMode("saved")} disabled={saved.length === 0}>
              Saved
            </ModeChip>
            <ModeChip active={mode === "upload"} onClick={() => setMode("upload")}>
              Upload
            </ModeChip>
            <ModeChip active={mode === "paste"} onClick={() => setMode("paste")}>
              Paste
            </ModeChip>
          </div>

          {mode === "saved" &&
            (saved.length ? (
              <Select value={savedId} onChange={(e) => setSavedId(e.target.value)}>
                {saved.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.filename})
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No saved resumes yet.</p>
            ))}
          {mode === "upload" && (
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--color-muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary-soft)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-primary-hover)]"
            />
          )}
          {mode === "paste" && (
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your resume text…"
            />
          )}

          <Button onClick={run} loading={busy}>
            {busy ? "Structuring…" : "Import & build"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function ModeChip({
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
          ? "rounded-lg bg-[var(--color-primary-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary-hover)]"
          : "rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-slate-100 disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

/* ---------------- AI suggestions (bullets + missing skills) ---------------- */

function AiSuggestions({
  sections,
  onAdd,
}: {
  sections: ResumeSection[];
  onAdd: (text: string, sectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [ack, setAck] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!target && sections[0]) setTarget(sections[0].id);
  }, [sections, target]);

  async function load() {
    setOpen(true);
    setMsg(null);
    setBullets(null);
    try {
      const list = await api<TrackerItem[]>("/me/analyses");
      const done = list.find((a) => a.status === "completed");
      if (!done) {
        setBullets([]);
        setMsg("Run an analysis first to get tailored suggestions.");
        return;
      }
      const full = await api<Analysis>(`/ai/analyze/${done.id}`);
      setBullets(full.suggested_bullets ?? []);
      setSkills(full.missing_skills ?? []);
      if (!full.suggested_bullets?.length && !full.missing_skills?.length)
        setMsg("That analysis had no suggestions.");
    } catch {
      setMsg("Couldn't load suggestions.");
      setBullets([]);
    }
  }

  const canAdd = ack && sections.length > 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI suggestions from your last analysis</h2>
        <Button variant="ghost" onClick={open ? () => setOpen(false) : load}>
          {open ? "Hide" : "Pull suggestions"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-4">
          {bullets === null ? (
            <Spinner className="size-5 text-[var(--color-primary)]" />
          ) : (
            <>
              {msg && <p className="text-sm text-[var(--color-muted)]">{msg}</p>}

              {(bullets.length > 0 || skills.length > 0) && (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Only add skills or experience you genuinely have. You are responsible for actually
                    acquiring the mentioned knowledge and experience before putting it on your resume.
                    <label className="mt-2 flex items-center gap-2 font-medium">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                      I understand, and confirm these are (or will be) truthful.
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    Add to section:
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.heading}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {skills.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">Missing skills</p>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => (
                      <button
                        key={i}
                        disabled={!canAdd}
                        onClick={() => onAdd(s, target)}
                        title={canAdd ? "Add as a bullet" : "Confirm the note above first"}
                        className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-40"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bullets.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">Suggested bullets</p>
                  <ul className="space-y-2">
                    {bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">{b}</span>
                        <button
                          disabled={!canAdd}
                          onClick={() => onAdd(b, target)}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] disabled:opacity-40"
                        >
                          + Add
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------- small field helpers ---------------- */

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
      />
    </label>
  );
}

function FieldArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
      />
    </label>
  );
}

function MiniInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm placeholder:text-[var(--color-subtle)] focus:border-[var(--color-primary)] focus:outline-none"
    />
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={
        "flex size-8 shrink-0 items-center justify-center rounded-md text-sm disabled:opacity-30 " +
        (danger
          ? "text-[var(--color-danger)] hover:bg-red-50"
          : "text-[var(--color-muted)] hover:bg-slate-100")
      }
    >
      {children}
    </button>
  );
}
