import { NextResponse } from "next/server";
import { withStorageError } from "@/lib/api-route-helpers";

function params(req: Request) {
  const { searchParams } = new URL(req.url);
  return {
    teamId: String(searchParams.get("teamId") ?? "").trim(),
    id: String(searchParams.get("id") ?? "").trim(),
    workflowId: String(searchParams.get("workflowId") ?? "").trim(),
    runId: String(searchParams.get("runId") ?? "").trim(),
  };
}

/** GET handler for /api/teams/workflows. */
export async function handleWorkflowsGet(
  req: Request,
  readOne: (teamId: string, id: string) => Promise<{ ok: boolean }>,
  listAll: (teamId: string) => Promise<{ ok: boolean }>
): Promise<NextResponse> {
  const { teamId, id } = params(req);
  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  return withStorageError(() => (id ? readOne(teamId, id) : listAll(teamId)));
}

/** GET handler for /api/teams/workflow-runs. */
export async function handleWorkflowRunsGet(
  req: Request,
  readOne: (teamId: string, workflowId: string, runId: string) => Promise<{ ok: boolean }>,
  listAll: (teamId: string, workflowId: string) => Promise<{ ok: boolean }>
): Promise<NextResponse> {
  const { teamId, workflowId, runId } = params(req);
  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!workflowId) return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
  return withStorageError(() => (runId ? readOne(teamId, workflowId, runId) : listAll(teamId, workflowId)));
}
