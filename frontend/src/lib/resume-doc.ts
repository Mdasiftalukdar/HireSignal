/*
  A structured résumé document. Editing a typed model (rather than raw
  contentEditable HTML) lets us render a faithful live A4 preview AND emit clean
  vector PDF + native DOCX from the exact same data — with real, selectable,
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
      "Results-driven engineer with experience building reliable, well-tested services. Add a 2–3 line summary tailored to the role you're targeting.",
    sections: [
      {
        id: uid(),
        heading: "Experience",
        entries: [
          {
            id: uid(),
            title: "Software Engineer",
            subtitle: "Company",
            meta: "2023 – Present · City",
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
