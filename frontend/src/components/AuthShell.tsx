import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { Card } from "@/components/ui";

/** Centered card layout used by the login / register / OTP screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Card className="p-7">
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && (
          <p className="mt-6 text-center text-sm text-[var(--color-muted)]">{footer}</p>
        )}
      </div>
    </main>
  );
}
