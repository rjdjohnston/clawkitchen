"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/ToastProvider";

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={
        "rounded-[var(--ck-radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors text-[color:var(--ck-text-secondary)] hover:bg-[color:var(--ck-bg-glass)] hover:text-[color:var(--ck-text-primary)]"
      }
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-dvh w-dvw bg-[color:var(--ck-bg)] text-[color:var(--ck-text-primary)]">
        {/* Left nav (teams-first) */}
        <aside className="hidden w-64 shrink-0 border-r border-[color:var(--ck-border-subtle)] bg-[color:var(--ck-bg-glass)] backdrop-blur-[var(--ck-glass-blur)] md:flex md:flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ck-border-subtle)] px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Claw Kitchen
            </Link>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
            <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">
              Teams
            </div>
            <NavLink href="/" label="Home" />
            <NavLink href="/goals" label="Goals" />

            <div className="mt-4 px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">
              Build
            </div>
            <NavLink href="/recipes" label="Recipes" />
            <NavLink href="/tickets" label="Tickets" />
            <NavLink href="/cron-jobs" label="Cron jobs" />
            <NavLink href="/settings" label="Settings" />
          </nav>

          <div className="flex items-center justify-between gap-2 border-t border-[color:var(--ck-border-subtle)] px-4 py-3">
            <a
              href="https://github.com/JIGGAI/ClawRecipes/tree/main/docs"
              target="_blank"
              rel="noreferrer"
              className="rounded-[var(--ck-radius-sm)] px-2 py-1 text-sm font-medium text-[color:var(--ck-text-secondary)] transition-colors hover:bg-[color:var(--ck-bg-glass)] hover:text-[color:var(--ck-text-primary)]"
            >
              Docs
            </a>
            <ThemeToggle />
          </div>
        </aside>

        {/* Main region */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar (mobile + global actions) */}
          <header className="sticky top-0 z-50 border-b border-[color:var(--ck-border-subtle)] bg-[color:var(--ck-bg-glass)] backdrop-blur-[var(--ck-glass-blur)]">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3 md:hidden">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                  Claw Kitchen
                </Link>
                <nav className="flex items-center gap-1">
                  <NavLink href="/" label="Home" />
                  <NavLink href="/recipes" label="Recipes" />
                  <NavLink href="/tickets" label="Tickets" />
                </nav>
              </div>

              <div className="ml-auto flex items-center gap-2 md:hidden">
                <a
                  href="https://github.com/JIGGAI/ClawRecipes/tree/main/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[var(--ck-radius-sm)] px-3 py-1.5 text-sm font-medium text-[color:var(--ck-text-secondary)] transition-colors hover:bg-[color:var(--ck-bg-glass)] hover:text-[color:var(--ck-text-primary)]"
                >
                  Docs
                </a>
                <ThemeToggle />
              </div>

              {/* Desktop top bar can stay minimal; left nav is primary */}
              <div className="hidden md:flex md:flex-1" />
              <div className="hidden items-center gap-2 md:flex">
                <a
                  href="https://github.com/JIGGAI/ClawRecipes/tree/main/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[var(--ck-radius-sm)] px-3 py-1.5 text-sm font-medium text-[color:var(--ck-text-secondary)] transition-colors hover:bg-[color:var(--ck-bg-glass)] hover:text-[color:var(--ck-text-primary)]"
                >
                  Docs
                </a>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
