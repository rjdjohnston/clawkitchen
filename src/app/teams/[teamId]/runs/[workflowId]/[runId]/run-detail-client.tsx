"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { errorMessage } from "@/lib/errors";

type NodeResult = {
  nodeId: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  error?: unknown;
};

type RunFile = {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  nodes?: NodeResult[];
  approval?: unknown;
  meta?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export default function RunDetailClient({
  teamId,
  workflowId,
  runId,
}: {
  teamId: string;
  workflowId: string;
  runId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [run, setRun] = useState<RunFile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const json = await fetchJson<{ ok?: boolean; run?: unknown; error?: string }>(
        `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(workflowId)}&runId=${encodeURIComponent(runId)}`,
        { cache: "no-store" }
      );
      if (!json.ok) throw new Error(json.error || "Failed to load run");
      if (!isRecord(json.run)) throw new Error("Invalid run format");

      const r = json.run as Record<string, unknown>;
      const nodesRaw = Array.isArray(r.nodes) ? r.nodes : [];

      setRun({
        id: String(r.id ?? runId),
        workflowId: String(r.workflowId ?? workflowId),
        status: String(r.status ?? ""),
        startedAt: String(r.startedAt ?? ""),
        endedAt: typeof r.endedAt === "string" ? r.endedAt : undefined,
        summary: typeof r.summary === "string" ? r.summary : undefined,
        nodes: nodesRaw
          .map((n) => (isRecord(n) ? n : null))
          .filter(Boolean)
          .map((n) => ({
            nodeId: String((n as Record<string, unknown>).nodeId ?? "").trim(),
            status: String((n as Record<string, unknown>).status ?? "").trim(),
            startedAt: typeof (n as Record<string, unknown>).startedAt === "string" ? ((n as Record<string, unknown>).startedAt as string) : undefined,
            endedAt: typeof (n as Record<string, unknown>).endedAt === "string" ? ((n as Record<string, unknown>).endedAt as string) : undefined,
            output: (n as Record<string, unknown>).output,
            error: (n as Record<string, unknown>).error,
          }))
          .filter((n) => Boolean(n.nodeId)),
        approval: r.approval,
        meta: r.meta,
      });
    } catch (e: unknown) {
      setError(errorMessage(e));
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [teamId, workflowId, runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nodes = run?.nodes ?? [];

  const approvalState = useMemo(() => {
    if (!run || !isRecord(run.approval)) return null;
    const o = run.approval as Record<string, unknown>;
    return {
      nodeId: String(o.nodeId ?? "").trim(),
      state: String(o.state ?? "").trim(),
      requestedAt: typeof o.requestedAt === "string" ? o.requestedAt : undefined,
      decidedAt: typeof o.decidedAt === "string" ? o.decidedAt : undefined,
      note: typeof o.note === "string" ? o.note : undefined,
    };
  }, [run]);

  async function doApprovalAction(action: "approve" | "request_changes" | "cancel") {
    if (!confirm(`${action.replace(/_/g, " ")}? This will update the run file.`)) return;

    try {
      const json = await fetchJson<{ ok?: boolean; error?: string }>("/api/teams/workflow-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, workflowId, runId, action }),
      });
      if (!json.ok) throw new Error(json.error || "Failed to update run");
      await load();
    } catch (e: unknown) {
      alert(errorMessage(e));
    }
  }

  if (loading) {
    return <div className="text-sm text-[color:var(--ck-text-secondary)]">Loading run…</div>;
  }

  if (error) {
    return (
      <div>
        <div className="text-sm text-red-100">{error}</div>
        <div className="mt-4">
          <Link
            href={`/teams/${encodeURIComponent(teamId)}/runs`}
            className="text-sm text-[color:var(--ck-text-secondary)] underline"
          >
            Back to runs
          </Link>
        </div>
      </div>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[color:var(--ck-text-tertiary)]">
            <Link href={`/teams/${encodeURIComponent(teamId)}/runs`} className="underline">
              Runs
            </Link>
            <span> / </span>
            <span className="font-mono">{workflowId}</span>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[color:var(--ck-text-primary)]">Run detail</h1>
          <div className="mt-1 text-sm text-[color:var(--ck-text-secondary)]">
            <span className="font-mono">{run.id}</span> • <span className="font-mono">{run.status}</span>
          </div>
          <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">
            Started: <span className="font-mono">{run.startedAt}</span>
            {run.endedAt ? (
              <>
                {" "}• Ended: <span className="font-mono">{run.endedAt}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/teams/${encodeURIComponent(teamId)}/workflows/${encodeURIComponent(workflowId)}`}
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
          >
            Open workflow
          </Link>

          <button
            type="button"
            disabled
            title="Rerun is not wired to a real execution engine yet (sample runs only)."
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] opacity-60"
          >
            Rerun
          </button>
        </div>
      </div>

      {run.summary ? (
        <div className="mt-4 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3 text-sm text-[color:var(--ck-text-secondary)]">
          {run.summary}
        </div>
      ) : null}

      {approvalState && approvalState.state === "pending" ? (
        <div className="mt-6 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Approval</div>
          <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">
            Waiting on node: <span className="font-mono">{approvalState.nodeId}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void doApprovalAction("approve")}
              className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => void doApprovalAction("request_changes")}
              className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
            >
              Request changes
            </button>
            <button
              type="button"
              onClick={() => void doApprovalAction("cancel")}
              className="rounded-[var(--ck-radius-sm)] border border-[color:rgba(255,59,48,0.45)] bg-[color:rgba(255,59,48,0.08)] px-3 py-2 text-sm font-medium text-[color:var(--ck-accent-red)] hover:bg-[color:rgba(255,59,48,0.12)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Step timeline</div>
          {nodes.length ? (
            <ol className="mt-3 space-y-2">
              {nodes.map((n, idx) => (
                <li key={`${n.nodeId}-${idx}`} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[color:var(--ck-text-primary)]">
                        <span className="font-mono">{n.nodeId}</span>
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">
                        {n.startedAt ? <span className="font-mono">{n.startedAt}</span> : ""}
                        {n.endedAt ? (
                          <>
                            {" "}→ <span className="font-mono">{n.endedAt}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-[color:var(--ck-text-secondary)]">
                      {n.status}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-2 text-sm text-[color:var(--ck-text-tertiary)]">No nodes recorded for this run yet.</div>
          )}
        </div>

        <div className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Logs / outputs</div>
          {nodes.length ? (
            <div className="mt-3 space-y-3">
              {nodes.map((n, idx) => (
                <div key={`${n.nodeId}-${idx}`} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-3">
                  <div className="text-xs text-[color:var(--ck-text-tertiary)]">
                    Node: <span className="font-mono">{n.nodeId}</span>
                  </div>

                  {n.error !== undefined ? (
                    <pre className="mt-2 overflow-auto rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-2 text-[11px] text-red-100">
                      {JSON.stringify(n.error, null, 2)}
                    </pre>
                  ) : null}

                  {n.output !== undefined ? (
                    <pre className="mt-2 overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/30 p-2 text-[11px] text-[color:var(--ck-text-secondary)]">
                      {JSON.stringify(n.output, null, 2)}
                    </pre>
                  ) : (
                    <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">(No output recorded.)</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-[color:var(--ck-text-tertiary)]">No logs yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
