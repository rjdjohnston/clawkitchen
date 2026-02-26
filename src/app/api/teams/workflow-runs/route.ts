import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { listWorkflowRuns, readWorkflowRun, writeWorkflowRun } from "@/lib/workflows/runs-storage";
import type { WorkflowRunFileV1, WorkflowRunNodeResultV1 } from "@/lib/workflows/runs-types";
import { readWorkflow } from "@/lib/workflows/storage";

function errMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = String(searchParams.get("teamId") ?? "").trim();
  const workflowId = String(searchParams.get("workflowId") ?? "").trim();
  const runId = String(searchParams.get("runId") ?? "").trim();

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!workflowId) return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });

  try {
    if (runId) {
      const r = await readWorkflowRun(teamId, workflowId, runId);
      const { ok, ...rest } = r;
      void ok;
      return NextResponse.json({ ok: true, ...rest });
    }

    const r = await listWorkflowRuns(teamId, workflowId);
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
  const workflowId = String(o.workflowId ?? "").trim();
  const mode = String(o.mode ?? "").trim();
  const action = String(o.action ?? "").trim();
  const runIdFromBody = String(o.runId ?? "").trim();
  const note = typeof o.note === "string" ? o.note : undefined;

  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!workflowId) return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });

  try {
    // Action mode: approve/request_changes/cancel (file-first) updates an existing run.
    if (action) {
      if (!runIdFromBody) return NextResponse.json({ ok: false, error: "runId is required for action" }, { status: 400 });
      if (!["approve", "request_changes", "cancel"].includes(action)) {
        return NextResponse.json({ ok: false, error: `Unsupported action: ${action}` }, { status: 400 });
      }

      const existing = await readWorkflowRun(teamId, workflowId, runIdFromBody);
      const run = existing.run;

      const approvalNodeId = run.approval?.nodeId || (Array.isArray(run.nodes) ? run.nodes.find((n) => n.status === "waiting")?.nodeId : undefined);
      if (!approvalNodeId) {
        return NextResponse.json({ ok: false, error: "Run is not awaiting approval" }, { status: 400 });
      }

      const decidedAt = nowIso();
      const nextState = action === "approve" ? "approved" : action === "request_changes" ? "changes_requested" : "canceled";

      const nextStatus: WorkflowRunFileV1["status"] =
        nextState === "approved" ? "success" : nextState === "canceled" ? "canceled" : "waiting_for_approval";

      const nextNodes: WorkflowRunNodeResultV1[] = Array.isArray(run.nodes)
        ? run.nodes.map((n) => {
            if (n.nodeId === approvalNodeId) {
              const existingOutput = typeof n.output === "object" && n.output ? (n.output as Record<string, unknown>) : {};
              return {
                ...n,
                status: nextState === "approved" ? "success" : nextState === "canceled" ? "error" : "waiting",
                endedAt: nextState === "changes_requested" ? n.endedAt : decidedAt,
                output: {
                  ...existingOutput,
                  decision: nextState,
                  note,
                },
              };
            }

            // For approve/cancel, resolve any remaining pending nodes so the run detail view is coherent.
            if (nextState === "approved" && n.status === "pending") {
              return {
                ...n,
                status: "success",
                startedAt: n.startedAt ?? decidedAt,
                endedAt: decidedAt,
                output: n.output ?? { note: "(execution engine not yet wired)" },
              };
            }

            if (nextState === "canceled" && n.status === "pending") {
              return {
                ...n,
                status: "skipped",
                startedAt: n.startedAt ?? decidedAt,
                endedAt: decidedAt,
                output: n.output ?? { note: "skipped due to cancel" },
              };
            }

            return n;
          })
        : [];

      const nextRun: WorkflowRunFileV1 = {
        ...run,
        status: nextStatus,
        endedAt: nextStatus === "success" || nextStatus === "canceled" ? decidedAt : run.endedAt,
        approval: {
          nodeId: approvalNodeId,
          state: nextState,
          requestedAt: run.approval?.requestedAt,
          decidedAt: nextState === "changes_requested" ? undefined : decidedAt,
          note,
        },
        nodes: nextNodes,
      };

      const wr = await writeWorkflowRun(teamId, workflowId, nextRun);
      const { ok, ...rest } = wr;
      void ok;
      return NextResponse.json({ ok: true, runId: run.id, ...rest });
    }

    // Create mode
    const runId = `run-${nowIso().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`.toLowerCase();

    const run: WorkflowRunFileV1 =
      mode === "sample"
        ? await (async () => {
            const wf = (await readWorkflow(teamId, workflowId)).workflow;
            const t0 = Date.now();

            const approvalIdx = wf.nodes.findIndex((n) => n.type === "human_approval");
            const approvalNodeId = approvalIdx >= 0 ? wf.nodes[approvalIdx]?.id : undefined;

            const nodeResults: WorkflowRunNodeResultV1[] = wf.nodes.map((n, idx) => {
              const startedAt = new Date(t0 + idx * 350).toISOString();
              const endedAt = new Date(t0 + idx * 350 + 200).toISOString();

              const beforeApproval = approvalIdx < 0 ? true : idx < approvalIdx;
              const isApproval = approvalNodeId ? n.id === approvalNodeId : false;
              const afterApproval = approvalIdx >= 0 && idx > approvalIdx;

              const base: WorkflowRunNodeResultV1 = {
                nodeId: n.id,
                status: beforeApproval ? "success" : afterApproval ? "pending" : isApproval ? "waiting" : "success",
                startedAt,
                endedAt: beforeApproval ? endedAt : undefined,
              };

              if (n.type === "llm") {
                return {
                  ...base,
                  output: beforeApproval
                    ? {
                        model: "(sample)",
                        text: `Sample output for ${n.id}`,
                      }
                    : undefined,
                };
              }

              if (n.type === "tool") {
                const toolVal = n.config && typeof n.config === "object" ? (n.config as Record<string, unknown>).tool : undefined;
                const tool = typeof toolVal === "string" && toolVal.trim() ? toolVal.trim() : "(unknown)";
                return {
                  ...base,
                  output: beforeApproval
                    ? {
                        tool,
                        result: "(sample tool result)",
                      }
                    : undefined,
                };
              }

              if (n.type === "human_approval") {
                return {
                  ...base,
                  output: {
                    channel: "(sample)",
                    decision: "pending",
                    options: ["approve", "request_changes", "cancel"],
                  },
                };
              }

              return base;
            });

            const status: WorkflowRunFileV1["status"] = approvalNodeId ? "waiting_for_approval" : "success";

            return {
              schema: "clawkitchen.workflow-run.v1",
              id: runId,
              workflowId,
              startedAt: new Date(t0).toISOString(),
              endedAt: approvalNodeId ? undefined : new Date(t0 + wf.nodes.length * 350 + 200).toISOString(),
              status,
              summary: approvalNodeId
                ? "Sample run (awaiting approval)"
                : "Sample run (generated by ClawKitchen UI)",
              nodes: nodeResults,
              approval: approvalNodeId
                ? {
                    nodeId: approvalNodeId,
                    state: "pending",
                    requestedAt: new Date(t0 + approvalIdx * 350).toISOString(),
                  }
                : undefined,
            } satisfies WorkflowRunFileV1;
          })()
        : {
            schema: "clawkitchen.workflow-run.v1",
            id: runId,
            workflowId,
            startedAt: nowIso(),
            status: "running",
            summary: "Run created (execution engine not yet wired)",
            nodes: [],
          };

    const r = await writeWorkflowRun(teamId, workflowId, run);
    const { ok, ...rest } = r;
    void ok;
    return NextResponse.json({ ok: true, runId, ...rest });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errMessage(err) }, { status: 500 });
  }
}
