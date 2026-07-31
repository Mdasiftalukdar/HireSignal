"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand, SignalGlyph } from "@/components/Brand";
import { Button, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Signed-in visitors go straight to the app; everyone else sees the landing page.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <Brand />
        <Spinner className="size-5 text-[var(--color-primary)]" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <Hero />
      <FlowSection />
      <Features />
      <HowItWorks />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}

/* ----------------------------- Nav ----------------------------- */

function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Brand />
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------- Hero ----------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 80% -10%, var(--color-primary-soft), transparent 60%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
            <SignalGlyph className="size-4 text-[var(--color-primary)]" />
            AI resume & job-fit analyzer
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-[var(--color-foreground)] sm:text-5xl">
            See your resume the way a{" "}
            <span className="text-[var(--color-primary)]">recruiter&apos;s ATS</span> does.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
            HireSignal scores your resume against any job description - surfacing the skills and
            keywords you&apos;re missing and rewriting your bullet points. Then edit and export a
            polished resume, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button className="px-6 py-3 text-base">Get started free</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" className="px-6 py-3 text-base">
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--color-subtle)]">
            Free to start · 2 AI analyses a day · bring your own API key for unlimited.
          </p>
        </div>
        <HeroReportCard />
      </div>
    </section>
  );
}

/** A stylized preview of what HireSignal produces - the match report. */
function HeroReportCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-xl">
        <div className="flex items-center gap-5">
          <ScoreRing score={87} />
          <div>
            <p className="text-sm font-semibold text-[var(--color-muted)]">Match score</p>
            <p className="text-2xl font-bold text-[var(--color-foreground)]">Strong fit</p>
            <p className="text-xs text-[var(--color-subtle)]">Senior Backend Engineer</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <ChipRow label="Matched" tone="success" items={["Python", "FastAPI", "PostgreSQL", "Kafka"]} />
          <ChipRow label="Missing" tone="danger" items={["Kubernetes", "CI/CD"]} />
        </div>
        <div className="mt-5 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-[var(--color-muted)]">Suggested bullet</p>
          <p className="mt-1 text-sm text-slate-700">
            Deployed microservices on Kubernetes, cutting release time by 40%.
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-border)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
        {score}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "success" | "danger";
}) {
  const cls =
    tone === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 pt-0.5 text-xs font-semibold text-[var(--color-subtle)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------- Takes → Produces flow --------------------- */

function FlowSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <FlowCard
          title="What you bring"
          items={["Your resume (PDF, DOCX, or paste)", "A job description to target"]}
        />
        <Arrow />
        <FlowCard
          title="What HireSignal does"
          items={["Retrieves & grades your resume", "Scores fit like a recruiter's ATS", "Self-critiques the feedback"]}
          highlight
        />
        <Arrow />
        <FlowCard
          title="What you get"
          items={["Fit score + skill gaps", "Keyword coverage & fixes", "Tailored bullets + editable resume"]}
        />
      </div>
    </section>
  );
}

function FlowCard({
  title,
  items,
  highlight,
}: {
  title: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border p-5 " +
        (highlight
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-background)]")
      }
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-foreground)]">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--color-muted)]">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-2xl text-[var(--color-subtle)] md:flex">
      →
    </div>
  );
}

/* ----------------------------- Features ----------------------------- */

const FEATURES = [
  { icon: "🎯", title: "ATS match score", body: "A 0-100 fit score grounded in your actual resume content - no guesswork." },
  { icon: "🧩", title: "Skill gap analysis", body: "Exactly which required skills you already show and which you're missing." },
  { icon: "🔑", title: "Keyword coverage", body: "The job's key terms present in your resume versus the ones you should add." },
  { icon: "✍️", title: "AI-tailored bullets", body: "Ready-to-paste, quantified bullet points that weave in the target skills." },
  { icon: "📝", title: "Live A4 editor", body: "Edit a WYSIWYG resume, apply suggestions, and export a real PDF or DOCX." },
  { icon: "📊", title: "Application tracker", body: "Keep every analysis with its score, applied status, and outcome in one table." },
];

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          Everything you need to tailor your resume
        </h2>
        <p className="mt-3 text-[var(--color-muted)]">
          From a recruiter-grade read of your fit to a finished, exportable resume.
        </p>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- How it works ----------------------------- */

function HowItWorks() {
  const steps = [
    { n: "1", title: "Add your resume & a job post", body: "Upload, paste, or pick a saved resume, then drop in the job description." },
    { n: "2", title: "The AI reads it like a recruiter", body: "An agent retrieves the relevant parts, scores your fit, and self-critiques its feedback." },
    { n: "3", title: "Get your report & polished resume", body: "Review your score and fixes, apply tailored bullets, and export a clean PDF or DOCX." },
  ];
  return (
    <section className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          How it works
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-lg font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- CTA + Footer ----------------------------- */

function CtaBand() {
  return (
    <section className="bg-[var(--color-primary)]">
      <div className="mx-auto max-w-4xl px-4 py-14 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Ready to sharpen your next application?
        </h2>
        <p className="mt-3 text-indigo-100">
          Create a free account and run your first analysis in under a minute.
        </p>
        <div className="mt-7 flex justify-center">
          <Link href="/register">
            <Button className="bg-white px-7 py-3 text-base text-[var(--color-primary-hover)] hover:bg-indigo-50">
              Get started free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
        <Brand />
        <p className="max-w-xl text-sm text-[var(--color-muted)]">
          HireSignal gives guidance to help you present your own, truthful experience. You are
          responsible for the accuracy of what you submit and publish.
        </p>
        <p className="text-xs text-[var(--color-subtle)]">
          © {year} HireSignal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
