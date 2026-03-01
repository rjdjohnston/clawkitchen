import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWorkspaceDir, teamDirFromBaseWorkspace } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;

  const baseWorkspace = await getWorkspaceDir();
  const teamDir = teamDirFromBaseWorkspace(baseWorkspace, teamId);
  const rolesDir = path.join(teamDir, "roles");

  let entries: string[] = [];
  try {
    entries = await fs.readdir(rolesDir);
  } catch {
    entries = [];
  }

  const assignees = entries.filter((e) => !e.startsWith(".")).sort();
  return NextResponse.json({ assignees });
}
