"use client";

import { useState } from "react";
import { SignalGlyph } from "@/components/Brand";

/** A small floating button (bottom-right of every page) with a short author note. */
export function AboutAuthor() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
        {open && (
          <div className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-base font-bold text-[var(--color-primary-hover)]">
                MA
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[var(--color-foreground)]">Md Asif Talukdar</p>
                <p className="truncate text-xs text-[var(--color-muted)]">
                  MSc Computer Science, University of Lethbridge
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              A software engineer focused on backend systems and applied AI. I built HireSignal after
              living the job hunt myself, staring at a resume and guessing what a recruiter&apos;s ATS
              would make of it. This turns that guesswork into a tool, free for anyone to use.
            </p>
            <div className="mt-4 flex gap-2">
              <a
                href="https://www.linkedin.com/in/mdasiftalukdar"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-slate-50"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/Mdasiftalukdar"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-slate-50"
              >
                GitHub
              </a>
            </div>
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] shadow-lg transition-shadow hover:shadow-xl"
        >
          <SignalGlyph className="size-4 text-[var(--color-primary)]" />
          {open ? "Close" : "About the author"}
        </button>
      </div>
    </>
  );
}
