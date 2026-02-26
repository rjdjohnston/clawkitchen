import fs from "node:fs/promises";
import path from "node:path";
import { getTeamWorkspaceDir } from "@/lib/paths";
import { assertSafeWorkflowId } from "@/lib/workflows/storage";
import type { WorkflowRunFileV1 } from "@/lib/workflows/runs-types";

const RUNS_DIR = path.join("shared-context", "workflow-runs");

export function assertSafeRunId(runId: string) {
  const id = String(runId ?? "").trim();
  if (!id) throw new Error("run id is required");
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) {
    throw new Error("Invalid run id. Use lowercase letters, numbers, and dashes (max 81 chars).");
  }
  return id;
}

export async function getWorkflowRunsDir(teamId: string, workflowId: string) {
  const wfId = assertSafeWorkflowId(workflowId);
  const teamDir = await getTeamWorkspaceDir(teamId);
  return path.join(teamDir, RUNS_DIR, wfId);
}

export function workflowRunFileName(runId: string) {
  return `${runId}.run.json`;
}

export async function listWorkflowRuns(teamId: string, workflowId: string) {
  const dir = await getWorkflowRunsDir(teamId, workflowId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".run.json"))
      .map((e) => e.name)
      .sort()
      .reverse();
    return { ok: true as const, dir, files };
  } catch (err: unknown) {
    if (err && typeof err === "object" && (err as { code?: unknown }).code === "ENOENT") {
      return { ok: true as const, dir, files: [] as string[] };
    }
    throw err;
  }
}

export async function readWorkflowRun(teamId: string, workflowId: string, runId: string) {
  const wfId = assertSafeWorkflowId(workflowId);
  const rId = assertSafeRunId(runId);
  const dir = await getWorkflowRunsDir(teamId, wfId);
  const p = path.join(dir, workflowRunFileName(rId));
  const raw = await fs.readFile(p, "utf8");
  const parsed = JSON.parse(raw) as WorkflowRunFileV1;
  return { ok: true as const, path: p, run: parsed };
}

export async function writeWorkflowRun(teamId: string, workflowId: string, run: WorkflowRunFileV1) {
  const wfId = assertSafeWorkflowId(workflowId);
  const rId = assertSafeRunId(run.id);
  const dir = await getWorkflowRunsDir(teamId, wfId);
  await fs.mkdir(dir, { recursive: true });
  const p = path.join(dir, workflowRunFileName(rId));
  const toWrite: WorkflowRunFileV1 = {
    ...run,
    schema: "clawkitchen.workflow-run.v1",
    id: rId,
    workflowId: wfId,
    teamId,
  };
  await fs.writeFile(p, JSON.stringify(toWrite, null, 2) + "\n", "utf8");
  return { ok: true as const, path: p };
}
