import { NextResponse } from "next/server";
import { toolsInvoke } from "@/lib/gateway";
import { getBaseWorkspaceFromGateway, markOrphanedInTeamWorkspaces } from "../helpers";

export async function POST(req: Request) {
  const body = (await req.json()) as { id?: string };
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const result = await toolsInvoke({ tool: "cron", args: { action: "remove", jobId: id } });

  let orphanedIn: Array<{ teamId: string; mappingPath: string; keys: string[] }> = [];
  try {
    const baseWorkspace = await getBaseWorkspaceFromGateway(toolsInvoke);
    if (baseWorkspace) {
      orphanedIn = await markOrphanedInTeamWorkspaces(id, baseWorkspace);
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id, result, orphanedIn });
}
