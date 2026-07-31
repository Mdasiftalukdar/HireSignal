"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { clsx } from "@/lib/clsx";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/tracker", label: "Tracker" },
  { href: "/editor", label: "Résumé editor" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  const initial = (user?.full_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]"
                      : "text-[var(--color-muted)] hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex size-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white"
            aria-label="Account menu"
          >
            {initial}
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg">
                <div className="border-b border-[var(--color-border)] px-3 py-2">
                  <p className="truncate text-sm font-semibold">
                    {user?.full_name || "Signed in"}
                  </p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--color-danger)] hover:bg-red-50"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[var(--color-border)] px-3 py-2 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
                active
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]"
                  : "text-[var(--color-muted)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
