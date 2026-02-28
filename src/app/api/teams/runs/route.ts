import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/errors";
// (no query helper)
import { listWorkflows } from "@/lib/workflows/storage";
import { listWorkflowRuns, readWorkflowRun } from "@/lib/workflows/runs-storage";

type RunListItem = {
  workflowId: string;
  runId: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  summary?: string;
  triggerKind?: string;
};

function asInt(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const teamId = String(sp.get("teamId") ?? "").trim();
  const workflowId = String(sp.get("workflowId") ?? "").trim();
  const status = String(sp.get("status") ?? "").trim();
  const since = String(sp.get("since") ?? "").trim();
  const until = String(sp.get("until") ?? "").trim();
  const limit = asInt(String(sp.get("limit") ?? ""), 50);

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });

  try {
    // NOTE: we list workflows first (source of truth), then gather their runs.
    // For MVP, we read run files to extract fields; we cap by `limit` after sorting.
    const wfFiles = await listWorkflows(teamId);
    const workflowIds = wfFiles.files
      .map((f) => (typeof f === "string" && f.endsWith(".workflow.json") ? f.slice(0, -".workflow.json".length) : null))
      .filter((x): x is string => Boolean(x));

    const candidates: Array<{ workflowId: string; runId: string }> = [];

    for (const wfId of workflowIds) {
      if (workflowId && wfId !== workflowId) continue;
      const files = await listWorkflowRuns(teamId, wfId);
      for (const f of files.files) {
        const runId = typeof f === "string" && f.endsWith(".run.json") ? f.slice(0, -".run.json".length) : "";
        if (runId) candidates.push({ workflowId: wfId, runId });
      }
    }

    const items: RunListItem[] = [];

    for (const c of candidates) {
      const run = (await readWorkflowRun(teamId, c.workflowId, c.runId)).run;

      const meta = isRecord(run.meta) ? run.meta : {};
      const triggerKind = typeof meta.triggerKind === "string" ? meta.triggerKind : undefined;

      const it: RunListItem = {
        workflowId: c.workflowId,
        runId: c.runId,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        summary: typeof run.summary === "string" ? run.summary : undefined,
        triggerKind,
      };

      if (status && it.status !== status) continue;
      if (since && it.startedAt && it.startedAt < since) continue;
      if (until && it.startedAt && it.startedAt > until) continue;

      items.push(it);
    }

    items.sort((a, b) => String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")));

    return NextResponse.json({ ok: true, runs: items.slice(0, limit) });
  } catch (e: unknown) {
    console.warn("/api/teams/runs failed", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
