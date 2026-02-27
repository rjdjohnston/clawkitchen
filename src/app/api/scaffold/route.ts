import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runOpenClaw } from "@/lib/openclaw";
import { buildScaffoldArgs } from "@/lib/scaffold";
import {
  validateAgentId,
  validateTeamId,
  withCronOverride,
  persistTeamProvenance,
  persistAgentProvenance,
} from "./helpers";

type ReqBody = Parameters<typeof buildScaffoldArgs>[0] & {
  cronInstallChoice?: "yes" | "no";
  allowExisting?: boolean;
};

const asString = (v: unknown) => {
  if (typeof v === "string") return v;
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (v && typeof (v as { toString?: unknown }).toString === "function") return String(v);
  return "";
};

function sha256(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function getRecipeIds(): Promise<Set<string>> {
  const recipesRes = await runOpenClaw(["recipes", "list"]);
  if (!recipesRes.ok) return new Set();
  try {
    const recipes = JSON.parse(recipesRes.stdout) as Array<{ id?: unknown }>;
    return new Set(recipes.map((r) => String(r.id ?? "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as ReqBody;

  let recipeHash: string | null = null;
  try {
    const shown = await runOpenClaw(["recipes", "show", body.recipeId]);
    if (shown.ok) recipeHash = sha256(shown.stdout);
  } catch {
    // ignore
  }

  const args = buildScaffoldArgs(body, { allowExisting: body.allowExisting });

  try {
    if (!body.overwrite && !body.allowExisting) {
      const recipeIds = await getRecipeIds();
      if (body.kind === "agent") {
        const agentId = String(body.agentId ?? "").trim();
        const err = await validateAgentId(agentId, recipeIds);
        if (err) return err;
      } else {
        const teamId = String(body.teamId ?? "").trim();
        const err = await validateTeamId(teamId, recipeIds);
        if (err) return err;
      }
    }

    return await withCronOverride(body.cronInstallChoice, async () => {
      const { stdout, stderr } = await runOpenClaw(args);

      if (body.kind === "team") {
        const teamId = String(body.teamId ?? "").trim();
        if (teamId) await persistTeamProvenance(teamId, body.recipeId, recipeHash);
      }

      if (body.kind === "agent") {
        const agentId = String(body.agentId ?? "").trim();
        if (agentId) await persistAgentProvenance(agentId, body.recipeId, recipeHash);
      }

      return NextResponse.json({ ok: true, args, stdout, stderr });
    });
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
