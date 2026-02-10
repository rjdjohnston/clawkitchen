import { NextResponse } from "next/server";
import { runOpenClaw } from "@/lib/openclaw";

type ReqBody =
  | {
      kind: "agent";
      recipeId: string;
      agentId?: string;
      name?: string;
      applyConfig?: boolean;
      overwrite?: boolean;
    }
  | {
      kind: "team";
      recipeId: string;
      teamId?: string;
      applyConfig?: boolean;
      overwrite?: boolean;
    };

const asString = (v: unknown) => {
  if (typeof v === "string") return v;
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (v && typeof (v as { toString?: unknown }).toString === "function") return String(v);
  return "";
};

export async function POST(req: Request) {
  const body = (await req.json()) as ReqBody;

  const args: string[] = ["recipes", body.kind === "team" ? "scaffold-team" : "scaffold", body.recipeId];

  if (body.overwrite) args.push("--overwrite");
  if (body.applyConfig) args.push("--apply-config");

  if (body.kind === "agent") {
    if (body.agentId) args.push("--agent-id", body.agentId);
    if (body.name) args.push("--name", body.name);
  } else {
    if (body.teamId) args.push("--team-id", body.teamId);
  }

  try {
    const { stdout, stderr } = await runOpenClaw(args);
    return NextResponse.json({ ok: true, args, stdout, stderr });
  } catch (e: unknown) {
    const err = e as { message?: string; stdout?: unknown; stderr?: unknown };
    return NextResponse.json(
      {
        ok: false,
        args,
        error: err?.message ?? String(e),
        stdout: asString(err?.stdout),
        stderr: asString(err?.stderr),
      },
      { status: 500 }
    );
  }
}
