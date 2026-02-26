import { NextResponse } from "next/server";
import { deleteWorkflow, listWorkflows, readWorkflow, writeWorkflow } from "@/lib/workflows/storage";
import type { WorkflowFileV1 } from "@/lib/workflows/types";

function errMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

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
  const { searchParams } = new URL(req.url);
  const teamId = String(searchParams.get("teamId") ?? "").trim();
  const id = String(searchParams.get("id") ?? "").trim();

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });

  try {
    if (id) {
      const r = await readWorkflow(teamId, id);
      // avoid duplicate `ok` keys (TS error)
      const { ok, ...rest } = r;
      void ok;
      return NextResponse.json({ ok: true, ...rest });
    }

    const r = await listWorkflows(teamId);
    const { ok, ...rest } = r;
    void ok;
    return NextResponse.json({ ok: true, ...rest });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const teamId = String(o.teamId ?? "").trim();
  const workflowRaw = o.workflow;

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!isWorkflowFileV1(workflowRaw)) {
    return NextResponse.json({ ok: false, error: "workflow is required (must include id, name, nodes[], edges[])" }, { status: 400 });
  }

  try {
    const r = await writeWorkflow(teamId, workflowRaw);
    const { ok, ...rest } = r;
    void ok;
    return NextResponse.json({ ok: true, ...rest });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = String(searchParams.get("teamId") ?? "").trim();
  const id = String(searchParams.get("id") ?? "").trim();

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  try {
    const r = await deleteWorkflow(teamId, id);
    const { ok, ...rest } = r;
    void ok;
    return NextResponse.json({ ok: true, ...rest });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errMessage(err) }, { status: 500 });
  }
}
