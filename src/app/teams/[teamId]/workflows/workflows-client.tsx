"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { errorMessage } from "@/lib/errors";

export default function WorkflowsClient({ teamId }: { teamId: string }) {
  const [workflows, setWorkflows] = useState<Array<{ id: string; name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    // Reset loading/error before fetch; standard data-fetch pattern
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on teamId change
    setLoading(true);
    setError("");
    fetchJson<{ ok?: boolean; files?: string[]; workflow?: { id: string; name?: string } }>(
      `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`,
      { cache: "no-store" }
    )
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) throw new Error("Failed to load workflows");
        const files = Array.isArray(json.files) ? json.files : [];
        const ids = files
          .map((f) => (f.endsWith(".workflow.json") ? f.slice(0, -".workflow.json".length) : null))
          .filter((id): id is string => Boolean(id));
        setWorkflows(ids.map((id) => ({ id, name: id })));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return <div className="ck-glass p-4">Loading workflows…</div>;
  }

  if (error) {
    return (
      <div className="ck-glass rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="ck-glass p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Workflow definitions</h2>
        <Link
          href={`/teams/${encodeURIComponent(teamId)}/workflows/new?draft=1`}
          className="rounded-[var(--ck-radius-sm)] bg-[color:var(--ck-accent)] px-3 py-2 text-sm font-medium text-black"
        >
          Create workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--ck-text-secondary)]">
          No workflows yet. Create one to get started.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {workflows.map((w) => (
            <li key={w.id}>
              <Link
                href={`/teams/${encodeURIComponent(teamId)}/workflows/${encodeURIComponent(w.id)}`}
                className="block rounded-[var(--ck-radius-sm)] border border-[color:var(--ck-border-subtle)] bg-white/5 px-4 py-3 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
              >
                {w.name || w.id}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
