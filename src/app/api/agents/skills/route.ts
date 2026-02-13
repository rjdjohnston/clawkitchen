import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { runOpenClaw } from "@/lib/openclaw";

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
  const skillsDir = path.join(ws, "skills");

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ ok: true, agentId, workspace: ws, skillsDir, skills });
  } catch (e: unknown) {
    return NextResponse.json({ ok: true, agentId, workspace: ws, skillsDir, skills: [], note: e instanceof Error ? e.message : String(e) });
  }
}
