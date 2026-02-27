import fs from "node:fs/promises";
import path from "node:path";
import { runOpenClaw } from "@/lib/openclaw";

export async function getAttachedTeams(workspaceRoot: string, recipeId: string): Promise<string[]> {
  const attachedTeams: string[] = [];
  const teamsRoot = path.resolve(workspaceRoot, "..");

  try {
    const entries = await fs.readdir(teamsRoot, { withFileTypes: true });
    const workspaceDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith("workspace-"));

    for (const dirent of workspaceDirs) {
      const metaPath = path.join(teamsRoot, dirent.name, "team.json");
      try {
        const raw = await fs.readFile(metaPath, "utf8");
        const meta = JSON.parse(raw) as { recipeId?: unknown; teamId?: unknown };
        if (String(meta.recipeId ?? "").trim() === recipeId) {
          attachedTeams.push(
            String(meta.teamId ?? dirent.name.replace(/^workspace-/, "")).trim() || dirent.name
          );
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return attachedTeams;
}

export async function getAttachedAgents(
  workspaceRoot: string,
  recipeId: string
): Promise<{ attachedAgents: string[]; hasSameIdAgent: boolean }> {
  const attachedAgents: string[] = [];
  let hasSameIdAgent = false;

  const agentsRes = await runOpenClaw(["agents", "list", "--json"]);
  if (!agentsRes.ok) return { attachedAgents, hasSameIdAgent };

  try {
    const agents = JSON.parse(agentsRes.stdout) as Array<{ id?: unknown }>;
    hasSameIdAgent = agents.some((a) => String(a.id ?? "").trim() === recipeId);

    for (const a of agents) {
      const agentId = String(a.id ?? "").trim();
      if (!agentId) continue;
      const metaPath = path.join(workspaceRoot, "agents", agentId, "agent.json");
      try {
        const raw = await fs.readFile(metaPath, "utf8");
        const meta = JSON.parse(raw) as { recipeId?: unknown };
        if (String(meta.recipeId ?? "").trim() === recipeId) attachedAgents.push(agentId);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return { attachedAgents, hasSameIdAgent };
}
