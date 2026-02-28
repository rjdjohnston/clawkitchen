"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { errorMessage } from "@/lib/errors";

type RunsListItem = {
  workflowId: string;
  runId: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  summary?: string;
  triggerKind?: string;
};

type WorkflowItem = { id: string };

function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export default function RunsClient({ teamId }: { teamId: string }) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const [items, setItems] = useState<RunsListItem[]>([]);

  const [workflowId, setWorkflowId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [range, setRange] = useState<string>("7d");

  const sinceIso = useMemo(() => {
    if (range === "24h") return isoDaysAgo(1);
    if (range === "7d") return isoDaysAgo(7);
    if (range === "30d") return isoDaysAgo(30);
    return "";
  }, [range]);

  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    try {
      const json = await fetchJson<{ ok?: boolean; files?: string[] }>(
        `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store" }
      );
      const files = Array.isArray(json.files) ? json.files : [];
      const ids = files
        .map((f) => (typeof f === "string" && f.endsWith(".workflow.json") ? f.slice(0, -".workflow.json".length) : null))
        .filter((x): x is string => Boolean(x));
      setWorkflows(ids.map((id) => ({ id })));
    } finally {
      setLoadingWorkflows(false);
    }
  }, [teamId]);

  const loadRuns = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const quiet = Boolean(opts?.quiet);
      setError("");
      if (!quiet) setLoading(true);

      try {
        const qs = new URLSearchParams();
        qs.set("teamId", teamId);
        if (workflowId) qs.set("workflowId", workflowId);
        if (status) qs.set("status", status);
        if (sinceIso) qs.set("since", sinceIso);
        qs.set("limit", "100");

        const json = await fetchJson<{ ok?: boolean; runs?: RunsListItem[]; error?: string }>(
          `/api/teams/runs?${qs.toString()}`,
          { cache: "no-store" }
        );
        if (!json.ok) throw new Error(json.error || "Failed to load runs");
        setItems(Array.isArray(json.runs) ? json.runs : []);
      } catch (e: unknown) {
        setError(errorMessage(e));
        setItems([]);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [teamId, workflowId, status, sinceIso]
  );

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadWorkflows(), loadRuns({ quiet: true })]);
    } finally {
      setRefreshing(false);
    }
  }

  const statusOptions = useMemo(
    () => ["running", "waiting_for_approval", "success", "error", "canceled"],
    []
  );

  if (loading) {
    return <div className="text-sm text-[color:var(--ck-text-secondary)]">Loading runs…</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">workflow</div>
            <select
              value={workflowId}
              onChange={(e) => setWorkflowId(String(e.target.value || ""))}
              disabled={loadingWorkflows}
              className="mt-1 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-2 text-sm text-[color:var(--ck-text-primary)] disabled:opacity-60"
            >
              <option value="">All workflows</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">status</div>
            <select
              value={status}
              onChange={(e) => setStatus(String(e.target.value || ""))}
              className="mt-1 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-2 text-sm text-[color:var(--ck-text-primary)]"
            >
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">time range</div>
            <select
              value={range}
              onChange={(e) => setRange(String(e.target.value || "7d"))}
              className="mt-1 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-2 text-sm text-[color:var(--ck-text-primary)]"
            >
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10 disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-6 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-4 text-sm text-[color:var(--ck-text-secondary)]">
          No runs found for the selected filters.
          <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
            Tip: open a workflow and click <span className="font-mono">+ Sample run</span> to generate a demo run file.
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-[var(--ck-radius-sm)] border border-white/10">
          <div className="grid grid-cols-12 gap-2 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">
            <div className="col-span-4">Run</div>
            <div className="col-span-3">Workflow</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Started</div>
          </div>

          <ul className="divide-y divide-white/10">
            {items.map((it) => (
              <li key={`${it.workflowId}:${it.runId}`} className="bg-black/10 hover:bg-white/5">
                <Link
                  href={`/teams/${encodeURIComponent(teamId)}/runs/${encodeURIComponent(it.workflowId)}/${encodeURIComponent(it.runId)}`}
                  className="grid grid-cols-12 gap-2 px-3 py-2"
                >
                  <div className="col-span-4 truncate font-mono text-xs text-[color:var(--ck-text-primary)]">{it.runId}</div>
                  <div className="col-span-3 truncate text-xs text-[color:var(--ck-text-secondary)]">{it.workflowId}</div>
                  <div className="col-span-2 truncate text-xs text-[color:var(--ck-text-secondary)]">{it.status ?? ""}</div>
                  <div className="col-span-3 truncate text-xs text-[color:var(--ck-text-tertiary)]">{it.startedAt ?? ""}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
