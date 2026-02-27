import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Validates and returns trimmed id; throws if empty or invalid format. */
export function normalizeId(kind: string, id: string): string {
  const s = String(id ?? "").trim();
  if (!s) throw new Error(`${kind} is required`);
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(s)) {
    throw new Error(`${kind} must match /^[a-z0-9][a-z0-9-]{0,62}$/i`);
  }
  return s;
}

/** Resolves workspace path for an agent/orchestrator by id (convention: workspace-<id>). */
export async function resolveAgentWorkspace(agentId: string): Promise<string> {
  const cfgPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  const raw = await fs.readFile(cfgPath, "utf8");
  const cfg = JSON.parse(raw) as { agents?: { defaults?: { workspace?: string } } };

  const baseWorkspace = String(cfg?.agents?.defaults?.workspace ?? "").trim();
  if (!baseWorkspace) throw new Error("agents.defaults.workspace not set");

  return path.resolve(baseWorkspace, "..", `workspace-${agentId}`);
}
