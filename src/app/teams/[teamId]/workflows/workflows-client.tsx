"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { errorMessage } from "@/lib/errors";

export default function WorkflowsClient({ teamId }: { teamId: string }) {
  const [workflows, setWorkflows] = useState<Array<{ id: string; name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const quiet = Boolean(opts?.quiet);
      setError("");
      if (!quiet) setLoading(true);
      try {
        const json = await fetchJson<{ ok?: boolean; files?: string[] }>(
          `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`,
          { cache: "no-store" }
        );
        if (!json.ok) throw new Error("Failed to load workflows");
        const files = Array.isArray(json.files) ? json.files : [];
        const ids = files
          .map((f) => (f.endsWith(".workflow.json") ? f.slice(0, -".workflow.json".length) : null))
          .filter((id): id is string => Boolean(id));
        setWorkflows(ids.map((id) => ({ id, name: id })));
      } catch (e: unknown) {
        setError(errorMessage(e));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [teamId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load({ quiet: true });
    } finally {
      setRefreshing(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(`Delete workflow “${id}”? This removes the .workflow.json file from the team workspace.`)) return;
    setError("");
    try {
      const json = await fetchJson<{ ok?: boolean; error?: string }>(
        `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!json.ok) throw new Error(json.error || "Failed to delete workflow");
      await load({ quiet: true });
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }

  // (template button removed)

  if (loading) {
    return <div className="ck-glass p-4">Loading workflows…</div>;
  }

  return (
    <div className="ck-glass p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Workflows (file-first)</h2>
          <p className="mt-1 text-sm text-[color:var(--ck-text-secondary)]">
            Stored in <code>shared-context/workflows/&lt;id&gt;.workflow.json</code> inside the team workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2">
          <Link
            href={`/teams/${encodeURIComponent(teamId)}/workflows/new?draft=1`}
            className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)]"
          >
            Add workflow
          </Link>

          {/* (Marketing Cadence template button removed) */}

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {workflows.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--ck-text-secondary)]">No workflows yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-[var(--ck-radius-sm)] border border-white/10">
          {workflows.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[color:var(--ck-text-primary)]">{w.name || w.id}</div>
                <div className="truncate text-xs text-[color:var(--ck-text-tertiary)]">{w.id}</div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/teams/${encodeURIComponent(teamId)}/workflows/${encodeURIComponent(w.id)}`}
                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => void onDelete(w.id)}
                  className="rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-100 hover:bg-red-500/15"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
