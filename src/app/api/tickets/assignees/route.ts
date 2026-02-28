import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const TEAM_WORKSPACE = "/home/control/.openclaw/workspace-development-team";

export async function GET() {
  // MVP: in development-team, treat role directories as available agentIds.
  // Future: should come from OpenClaw team config (bindings/agents) and be team-scoped.
  const rolesDir = path.join(TEAM_WORKSPACE, "roles");

  let entries: string[] = [];
  try {
    entries = await fs.readdir(rolesDir);
  } catch {
    entries = [];
  }

  const assignees = entries
    .filter((e) => !e.startsWith("."))
    .sort();

  return NextResponse.json({ assignees });
}
