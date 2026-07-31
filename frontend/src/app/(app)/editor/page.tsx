"use client";

import { useEffect, useState } from "react";
import { Button, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportDocx, exportPdf } from "@/lib/resume-export";
import {
  contactLine,
  defaultResume,
  loadResume,
  newEntry,
  newSection,
  saveResume,
  type ResumeDoc,
  type ResumeEntry,
  type ResumeSection,
} from "@/lib/resume-doc";
import type { Analysis, TrackerItem } from "@/lib/types";

export default function EditorPage() {
  const { user } = useAuth();
  const [doc, setDoc] = useState<ResumeDoc | null>(null);

  useEffect(() => {
    setDoc(loadResume() ?? defaultResume(user?.full_name ?? "", user?.email ?? ""));
  }, [user]);

  // Auto-save to localStorage on every change.
  useEffect(() => {
    if (doc) saveResume(doc);
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
          <h1 className="text-2xl font-bold">Résumé editor</h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Edit on the left, preview live on the right, export a real PDF or DOCX. Saved in your browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportDocx(doc)}>
            Export DOCX
          </Button>
          <Button onClick={() => exportPdf(doc)}>Export PDF</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* -------- Editor -------- */}
        <div className="space-y-5">
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
                if (confirm("Reset the résumé to the starter template? This clears your edits."))
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

/* ---------------- AI bullet suggestions ---------------- */

function AiSuggestions({
  sections,
  onAdd,
}: {
  sections: ResumeSection[];
  onAdd: (bullet: string, sectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [target, setTarget] = useState("");
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
        setMsg("Run an analysis first to get tailored bullet suggestions.");
        return;
      }
      const full = await api<Analysis>(`/ai/analyze/${done.id}`);
      setBullets(full.suggested_bullets ?? []);
      if (!full.suggested_bullets?.length) setMsg("That analysis had no bullet suggestions.");
    } catch {
      setMsg("Couldn't load suggestions.");
      setBullets([]);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI bullet suggestions</h2>
        <Button variant="ghost" onClick={open ? () => setOpen(false) : load}>
          {open ? "Hide" : "Pull from last analysis"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {bullets === null ? (
            <Spinner className="size-5 text-[var(--color-primary)]" />
          ) : (
            <>
              {msg && <p className="text-sm text-[var(--color-muted)]">{msg}</p>}
              {bullets.length > 0 && (
                <>
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
                  <ul className="space-y-2">
                    {bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">{b}</span>
                        <button
                          onClick={() => onAdd(b, target)}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                        >
                          + Add
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
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
