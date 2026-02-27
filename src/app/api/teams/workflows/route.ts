import { NextResponse } from "next/server";
import { jsonOkRest, parseJsonBody } from "@/lib/api-route-helpers";
import { errorMessage } from "@/lib/errors";
import { handleWorkflowsGet } from "@/lib/workflows/api-handlers";
import { deleteWorkflow, listWorkflows, readWorkflow, writeWorkflow } from "@/lib/workflows/storage";
import type { WorkflowFileV1 } from "@/lib/workflows/types";

function isWorkflowFileV1(v: unknown): v is WorkflowFileV1 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return false;
  if (typeof o.name !== "string" || !o.name.trim()) return false;
  if (!Array.isArray(o.nodes)) return false;
  if (!Array.isArray(o.edges)) return false;
  return true;
}

export async function GET(req: Request) {
  return handleWorkflowsGet(req, readWorkflow, listWorkflows);
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { body: o } = parsed;

  const teamId = String(o.teamId ?? "").trim();
  const workflowRaw = o.workflow;

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!isWorkflowFileV1(workflowRaw)) {
    return NextResponse.json({ ok: false, error: "workflow is required (must include id, name, nodes[], edges[])" }, { status: 400 });
  }

  try {
    return jsonOkRest(await writeWorkflow(teamId, workflowRaw));
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = String(searchParams.get("teamId") ?? "").trim();
  const id = String(searchParams.get("id") ?? "").trim();

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  try {
    return jsonOkRest(await deleteWorkflow(teamId, id));
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(err) }, { status: 500 });
  }
}
