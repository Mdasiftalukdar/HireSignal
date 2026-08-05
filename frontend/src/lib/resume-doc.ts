/*
  A structured resume document. Editing a typed model (rather than raw
  contentEditable HTML) lets us render a faithful live A4 preview AND emit clean
  vector PDF + native DOCX from the exact same data - with real, selectable,
  ATS-friendly text.
*/

export interface ResumeEntry {
  id: string;
  title: string; // role / degree / project name
  subtitle: string; // company / school / stack
  meta: string; // dates · location
  bullets: string[];
}

export interface ResumeSection {
  id: string;
  heading: string;
  entries: ResumeEntry[];
}

export interface ResumeDoc {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  sections: ResumeSection[];
}

const STORAGE_KEY = "hs_resume_doc";

export function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function newEntry(): ResumeEntry {
  return { id: uid(), title: "", subtitle: "", meta: "", bullets: [""] };
}

export function newSection(heading = "New section"): ResumeSection {
  return { id: uid(), heading, entries: [newEntry()] };
}

/** A sensible starter, seeded with whatever we know about the user. */
export function defaultResume(name = "", email = ""): ResumeDoc {
  return {
    fullName: name || "Your Name",
    headline: "Software Engineer",
    email,
    phone: "",
    location: "",
    website: "",
    summary:
      "Results-driven engineer with experience building reliable, well-tested services. Add a 2-3 line summary tailored to the role you're targeting.",
    sections: [
      {
        id: uid(),
        heading: "Experience",
        entries: [
          {
            id: uid(),
            title: "Software Engineer",
            subtitle: "Company",
            meta: "2023 - Present · City",
            bullets: [
              "Describe an achievement with a metric (e.g. cut latency 40%).",
              "Highlight a technology from the target job description.",
            ],
          },
        ],
      },
      {
        id: uid(),
        heading: "Skills",
        entries: [
          {
            id: uid(),
            title: "",
            subtitle: "",
            meta: "",
            bullets: ["Python, FastAPI, PostgreSQL, Redis, Docker, AWS"],
          },
        ],
      },
      {
        id: uid(),
        heading: "Education",
        entries: [
          {
            id: uid(),
            title: "MSc Computer Science",
            subtitle: "University",
            meta: "Year",
            bullets: [],
          },
        ],
      },
    ],
  };
}

/**
 * Coerce any stored/partial object into a complete ResumeDoc so the editor and
 * preview never hit an undefined field (e.g. an older save missing `summary`).
 */
export function normalizeResume(
  d: Partial<ResumeDoc> | null | undefined,
  fallbackName = "",
  fallbackEmail = "",
): ResumeDoc {
  const base = defaultResume(fallbackName, fallbackEmail);
  if (!d || typeof d !== "object") return base;
  return {
    fullName: d.fullName ?? base.fullName,
    headline: d.headline ?? "",
    email: d.email ?? "",
    phone: d.phone ?? "",
    location: d.location ?? "",
    website: d.website ?? "",
    summary: d.summary ?? "",
    sections: Array.isArray(d.sections)
      ? d.sections.map((s) => ({
          id: s?.id ?? uid(),
          heading: s?.heading ?? "Section",
          entries: Array.isArray(s?.entries)
            ? s.entries.map((e) => ({
                id: e?.id ?? uid(),
                title: e?.title ?? "",
                subtitle: e?.subtitle ?? "",
                meta: e?.meta ?? "",
                bullets: Array.isArray(e?.bullets) ? e.bullets.map((b) => String(b ?? "")) : [],
              }))
            : [],
        }))
      : base.sections,
  };
}

export function loadResume(): ResumeDoc | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ResumeDoc;
  } catch {
    return null;
  }
}

export function saveResume(doc: ResumeDoc) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

export function contactLine(doc: ResumeDoc): string {
  return [doc.email, doc.phone, doc.location, doc.website].filter(Boolean).join("  •  ");
}

// ---- Server-side persistence (syncs the doc across devices) ----

import { api } from "@/lib/api";

export async function loadServerResume(): Promise<ResumeDoc | null> {
  const res = await api<{ data: ResumeDoc | null }>("/me/resume-doc");
  return res.data;
}

export async function saveServerResume(doc: ResumeDoc): Promise<void> {
  await api("/me/resume-doc", { method: "PUT", body: { json: doc } });
}

// Import a saved/uploaded/pasted resume: the backend parses it into structured
// JSON, which we normalize into a full editable ResumeDoc (ids + defaults filled).
export async function importResume(form: FormData): Promise<ResumeDoc> {
  const raw = await api<Partial<ResumeDoc>>("/ai/resume-structure", {
    method: "POST",
    body: { formData: form },
  });
  return normalizeResume(raw);
}
