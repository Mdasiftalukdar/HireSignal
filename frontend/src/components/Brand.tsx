import { clsx } from "@/lib/clsx";

/** HireSignal wordmark + signal glyph. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <SignalGlyph className="size-7 text-[var(--color-primary)]" />
      <span className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
        Hire<span className="text-[var(--color-primary)]">Signal</span>
      </span>
    </span>
  );
}

export function SignalGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="14" width="4" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="9" y="9" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.75" />
      <rect x="16" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
    </svg>
  );
}
