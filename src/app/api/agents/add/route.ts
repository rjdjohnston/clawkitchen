import { NextResponse } from "next/server";
import path from "node:path";

import { runOpenClaw } from "@/lib/openclaw";

type Body = {
  newAgentId: string;
  name?: string;
  emoji?: string;
  theme?: string;
  avatar?: string;
  model?: string;
};

function homeDir() {
  return process.env.HOME || "/home/control";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const newAgentId = body.newAgentId?.trim();
    if (!newAgentId) {
      return NextResponse.json({ error: "newAgentId is required" }, { status: 400 });
    }

    // Convention used by most installs: ~/.openclaw/workspace-<agentId>
    const workspace = path.join(homeDir(), ".openclaw", `workspace-${newAgentId}`);

    const addArgs = ["agents", "add", newAgentId, "--non-interactive", "--workspace", workspace, "--json"];
    if (body.model?.trim()) addArgs.push("--model", body.model.trim());

    const addResult = await runOpenClaw(addArgs);

    // Best-effort: set identity after creation.
    const identityArgs = ["agents", "set-identity", newAgentId];
    if (body.name?.trim()) identityArgs.push("--name", body.name.trim());
    if (body.emoji?.trim()) identityArgs.push("--emoji", body.emoji.trim());
    if (body.theme?.trim()) identityArgs.push("--theme", body.theme.trim());
    if (body.avatar?.trim()) identityArgs.push("--avatar", body.avatar.trim());

    const identityResult = await runOpenClaw(identityArgs);

    return NextResponse.json({
      ok: true,
      workspace,
      add: addResult,
      identity: identityResult,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to add agent",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
