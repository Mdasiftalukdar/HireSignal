/*
  Shown beneath the primary auth button. A polite, professional reminder that the
  user is responsible for the truthfulness of what they submit - treated as agreed
  by continuing (a lightweight click-through acknowledgement).
*/
export function ConsentNote({ action }: { action: string }) {
  return (
    <p className="mt-4 text-center text-xs leading-relaxed text-[var(--color-subtle)]">
      By {action}, you agree to use HireSignal honestly and responsibly, and confirm that the
      resume and information you provide are truthful and your own.
    </p>
  );
}
