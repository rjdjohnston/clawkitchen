import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { runOpenClaw } from "@/lib/openclaw";
import { parseTeamRoleWorkspace } from "@/lib/agent-workspace";

type AgentListItem = { id: string; workspace?: string };

async function resolveAgentWorkspace(agentId: string) {
  const { stdout } = await runOpenClaw(["agents", "list", "--json"]);
  const list = JSON.parse(stdout) as AgentListItem[];
  const agent = list.find((a) => a.id === agentId);
  if (!agent?.workspace) throw new Error(`Agent workspace not found for ${agentId}`);
  return agent.workspace;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = String(searchParams.get("agentId") ?? "").trim();
  if (!agentId) return NextResponse.json({ ok: false, error: "agentId is required" }, { status: 400 });

  const ws = await resolveAgentWorkspace(agentId);

  const info = parseTeamRoleWorkspace(ws);
  const dirs: string[] = [path.join(ws, "skills")];
  if (info.kind === "teamRole") {
    // If skills were installed at the team scope, surface them for the role agent too.
    dirs.push(path.join(info.teamDir, "skills"));
  }

  const skills = new Set<string>();
  const notes: string[] = [];

  for (const skillsDir of dirs) {
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const e of entries) if (e.isDirectory()) skills.add(e.name);
    } catch (e: unknown) {
      notes.push(`${skillsDir}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    agentId,
    workspace: ws,
    skillsDirs: dirs,
    skills: Array.from(skills).sort((a, b) => a.localeCompare(b)),
    note: notes.length ? notes.join("; ") : undefined,
  });
}
