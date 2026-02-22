import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { runOpenClaw } from "@/lib/openclaw";
import { parseTeamRoleWorkspace } from "@/lib/agent-workspace";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agentId = String(id ?? "").trim();
    if (!agentId) return NextResponse.json({ ok: false, error: "agent id is required" }, { status: 400 });

    // Resolve workspace BEFORE deleting (after deletion it may disappear from list).
    let workspace: string | null = null;
    try {
      const { stdout } = await runOpenClaw(["agents", "list", "--json"]);
      const list = JSON.parse(stdout) as Array<{ id: string; workspace?: string }>;
      const agent = list.find((a) => a.id === agentId);
      workspace = agent?.workspace ? String(agent.workspace) : null;
    } catch {
      workspace = null;
    }

    const result = await runOpenClaw(["agents", "delete", agentId, "--force", "--json"]);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to delete agent: ${agentId}`,
          stderr: result.stderr || undefined,
          stdout: result.stdout || undefined,
        },
        { status: 500 },
      );
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }

    // If this was a team role agent, also remove its role directory.
    // Safer than rm: move to a team-local .trash folder.
    if (workspace) {
      const info = parseTeamRoleWorkspace(workspace);
      if (info.kind === "teamRole") {
        const trashDir = path.join(info.teamDir, ".trash", "roles");
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const dst = path.join(trashDir, `${info.role}-${ts}`);
        try {
          await fs.mkdir(trashDir, { recursive: true });
          // Only move if the dir exists.
          await fs.rename(info.roleDir, dst);
        } catch {
          // If rename fails (cross-device / missing), fall back to best-effort recursive removal.
          try {
            await fs.rm(info.roleDir, { recursive: true, force: true });
          } catch {
            // ignore
          }
        }
      }
    }

    return NextResponse.json({ ok: true, result: parsed ?? result.stdout });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to delete agent",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
