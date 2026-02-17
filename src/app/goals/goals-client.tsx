"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Goal = {
  id: string;
  title: string;
  status: "planned" | "active" | "done";
  tags: string[];
  teams: string[];
  updatedAt: string;
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[color:var(--ck-bg-glass)] px-2 py-0.5 text-xs text-[color:var(--ck-text-secondary)]">
      {children}
    </span>
  );
}

export default function GoalsClient() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const teamFilter = (searchParams.get("team") ?? "").trim();

  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/goals", { cache: "no-store" });
        const data = (await res.json()) as unknown;
        if (cancelled) return;

        const obj = (data && typeof data === "object") ? (data as Record<string, unknown>) : {};

        if (!res.ok) {
          const msg = obj.error ?? "Failed to load goals";
          setError(String(msg));
          setGoals([]);
          return;
        }

        setError(null);
        setGoals((obj.goals ?? []) as Goal[]);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setGoals([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    // reuse the same logic by forcing a page-level refetch
    // (simple and avoids extra hooks)
    setGoals(null);
    setError(null);
    const res = await fetch("/api/goals", { cache: "no-store" });
    const data = (await res.json()) as unknown;
    const obj = (data && typeof data === "object") ? (data as Record<string, unknown>) : {};
    if (!res.ok) {
      setError(String(obj.error ?? "Failed to load goals"));
      setGoals([]);
      return;
    }
    setGoals((obj.goals ?? []) as Goal[]);
  }

  const filtered = useMemo(() => {
    let list = goals ?? [];
    if (teamFilter) list = list.filter((g) => Array.isArray(g.teams) && g.teams.includes(teamFilter));
    if (filterStatus === "all") return list;
    return list.filter((g) => g.status === filterStatus);
  }, [goals, filterStatus, teamFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="mt-1 text-sm text-[color:var(--ck-text-secondary)]">
            Stored in <code className="font-mono">~/.openclaw/workspace/notes/goals/</code>
            {teamFilter ? (
              <>
                {" "}• filtered by team <code className="font-mono">{teamFilter}</code>
              </>
            ) : null}
          </p>
        </div>
        <Link
          href="/goals/new"
          className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white"
        >
          Create goal
        </Link>
      </div>

      <div className="ck-glass p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[color:var(--ck-text-secondary)]">Status</label>
          <select
            className="rounded-[var(--ck-radius-sm)] border border-[color:var(--ck-border-subtle)] bg-transparent px-2 py-1 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="done">Done</option>
          </select>

          <button
            className="ml-auto text-sm font-medium hover:underline"
            onClick={() => void reload()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="ck-glass p-4 text-sm text-red-300">{error}</div>
      ) : null}

      {goals == null ? (
        <div className="ck-glass p-6 text-sm text-[color:var(--ck-text-secondary)]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="ck-glass p-6">
          <div className="text-sm text-[color:var(--ck-text-secondary)]">No goals yet.</div>
          <div className="mt-3">
            <Link href="/goals/new" className="text-sm font-medium hover:underline">
              Create your first goal →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => (
            <Link
              key={g.id}
              href={`/goals/${encodeURIComponent(g.id)}`}
              className="block ck-glass p-5 transition hover:bg-[color:var(--ck-bg-glass)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-[color:var(--ck-text-primary)]">{g.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">
                    <span className="font-mono">{g.id}</span>
                    {g.updatedAt ? ` • updated ${new Date(g.updatedAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{g.status}</Badge>
                  {g.teams?.slice(0, 3).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                  {g.tags?.slice(0, 3).map((t) => (
                    <Badge key={t}>#{t}</Badge>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
