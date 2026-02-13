import { NextResponse } from "next/server";

import { runOpenClaw } from "@/lib/openclaw";

type AgentListItem = {
  id: string;
  identityName?: string;
  workspace?: string;
  model?: string;
  isDefault?: boolean;
};

export async function GET() {
  try {
    const { stdout, stderr } = await runOpenClaw(["agents", "list", "--json"]);

    const agents = JSON.parse(stdout) as AgentListItem[];

    return NextResponse.json({ agents, stderr: stderr || undefined });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to list agents",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
