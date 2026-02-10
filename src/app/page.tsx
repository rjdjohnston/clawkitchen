import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="ck-glass mx-auto max-w-3xl p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Claw Kitchen <span className="text-sm align-middle text-[color:var(--ck-text-secondary)]">(Phase 1)</span>
        </h1>
        <p className="mt-3 max-w-prose text-[color:var(--ck-text-secondary)]">
          Local-first UI for authoring Clawcipes recipes and scaffolding agents/teams.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/recipes"
            className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-4 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] transition-colors hover:bg-[var(--ck-accent-red-hover)] active:bg-[var(--ck-accent-red-active)]"
          >
            Recipes
          </Link>
        </div>
      </div>
    </main>
  );
}
