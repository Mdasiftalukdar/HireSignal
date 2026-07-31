import { Card } from "@/components/ui";

/** Temporary section placeholder, replaced as each R3 slice is built. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{title}</h1>
      <Card className="p-10 text-center">
        <p className="text-[var(--color-muted)]">{note}</p>
        <p className="mt-2 text-sm text-[var(--color-subtle)]">Coming in the next build slice.</p>
      </Card>
    </div>
  );
}
