import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getTeamWorkspaceDir } from "@/lib/tickets";

export async function GET() {
  // MVP: in development-team, treat role directories as available agentIds.
  // Future: should come from OpenClaw team config (bindings/agents) and be team-scoped.
  const rolesDir = path.join(getTeamWorkspaceDir(), "roles");

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
