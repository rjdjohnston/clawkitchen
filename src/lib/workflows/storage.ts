import fs from "node:fs/promises";
import path from "node:path";
import { getTeamWorkspaceDir } from "@/lib/paths";
import type { WorkflowFileV1 } from "@/lib/workflows/types";

const WORKFLOWS_DIR = path.join("shared-context", "workflows");

export function workflowFileName(workflowId: string) {
  return `${workflowId}.workflow.json`;
}

export function assertSafeWorkflowId(workflowId: string) {
  const id = String(workflowId ?? "").trim();
  if (!id) throw new Error("workflow id is required");
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
    throw new Error(
      "Invalid workflow id. Use lowercase letters, numbers, and dashes (max 63 chars), e.g. marketing-cadence-v1"
    );
  }
  return id;
}

export async function getTeamWorkflowsDir(teamId: string) {
  const teamDir = await getTeamWorkspaceDir(teamId);
  return path.join(teamDir, WORKFLOWS_DIR);
}

export async function listWorkflows(teamId: string) {
  const dir = await getTeamWorkflowsDir(teamId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".workflow.json"))
      .map((e) => e.name)
      .sort();

    return { ok: true as const, dir, files };
  } catch (err: unknown) {
    if (err && typeof err === "object" && (err as { code?: unknown }).code === "ENOENT") {
      return { ok: true as const, dir, files: [] as string[] };
    }
    throw err;
  }
}

export async function readWorkflow(teamId: string, workflowId: string) {
  const id = assertSafeWorkflowId(workflowId);
  const dir = await getTeamWorkflowsDir(teamId);
  const p = path.join(dir, workflowFileName(id));
  const raw = await fs.readFile(p, "utf8");
  const parsed = JSON.parse(raw) as WorkflowFileV1;
  return { ok: true as const, path: p, workflow: parsed };
}

export async function writeWorkflow(teamId: string, workflow: WorkflowFileV1) {
  const id = assertSafeWorkflowId(workflow.id);
  const dir = await getTeamWorkflowsDir(teamId);
  await fs.mkdir(dir, { recursive: true });
  const p = path.join(dir, workflowFileName(id));
  const toWrite: WorkflowFileV1 = {
    ...workflow,
    schema: "clawkitchen.workflow.v1",
    id,
  };
  await fs.writeFile(p, JSON.stringify(toWrite, null, 2) + "\n", "utf8");
  return { ok: true as const, path: p };
}
