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
  const body = (await req.json()) as ReqBody & { cronInstallChoice?: "yes" | "no" };

  const args: string[] = ["recipes", body.kind === "team" ? "scaffold-team" : "scaffold", body.recipeId];

  if (body.overwrite) args.push("--overwrite");
  if (body.applyConfig) args.push("--apply-config");

  if (body.kind === "agent") {
    if (body.agentId) args.push("--agent-id", body.agentId);
    if (body.name) args.push("--name", body.name);
  } else {
    if (body.teamId) args.push("--team-id", body.teamId);
  }

  // Kitchen runs scaffold non-interactively, so the recipes plugin cannot prompt.
  // To emulate prompt semantics, we optionally override cronInstallation for this one scaffold run.
  let prevCronInstallation: string | null = null;
  const override = body.cronInstallChoice;

  try {
    if (override === "yes" || override === "no") {
      const cfgPath = "plugins.entries.recipes.config.cronInstallation";
      const prev = await runOpenClaw(["config", "get", cfgPath]);
      prevCronInstallation = prev.stdout.trim() || null;
      const next = override === "yes" ? "on" : "off";
      await runOpenClaw(["config", "set", cfgPath, next]);
    }

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
  } finally {
    if (prevCronInstallation !== null) {
      try {
        await runOpenClaw(["config", "set", "plugins.entries.recipes.config.cronInstallation", prevCronInstallation]);
      } catch {
        // best-effort restore
      }
    }
  }
}

