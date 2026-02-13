import { NextResponse } from "next/server";

import { runOpenClaw } from "@/lib/openclaw";

type Body = {
  agentId: string;
  name?: string;
  emoji?: string;
  theme?: string;
  avatar?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const agentId = body.agentId?.trim();

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const args = ["agents", "set-identity", agentId];

    if (body.name?.trim()) args.push("--name", body.name.trim());
    if (body.emoji?.trim()) args.push("--emoji", body.emoji.trim());
    if (body.theme?.trim()) args.push("--theme", body.theme.trim());
    if (body.avatar?.trim()) args.push("--avatar", body.avatar.trim());

    const { stdout, stderr } = await runOpenClaw(args);

    return NextResponse.json({ ok: true, stdout, stderr });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to set agent identity",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
