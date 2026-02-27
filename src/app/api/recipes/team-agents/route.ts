import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWorkspaceRecipesDir } from "@/lib/paths";
import {
  splitFrontmatter,
  normalizeRole,
  parseRecipeFrontmatter,
  buildNextMarkdown,
  handleRemove,
  handleAdd,
  handleAddLike,
} from "./helpers";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    recipeId?: string;
    op?: "add" | "remove" | "addLike";
    role?: string;
    baseRole?: string;
    teamId?: string;
    name?: string;
  };

  const recipeId = String(body.recipeId ?? "").trim();
  const op = body.op;
  if (!recipeId) return NextResponse.json({ ok: false, error: "recipeId is required" }, { status: 400 });
  if (op !== "add" && op !== "remove" && op !== "addLike") {
    return NextResponse.json({ ok: false, error: "op must be add|remove|addLike" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  const dir = await getWorkspaceRecipesDir();
  const filePath = path.join(dir, `${recipeId}.md`);

  const md = await fs.readFile(filePath, "utf8");
  const { yamlText, rest } = splitFrontmatter(md);
  const { fm, agents, templates } = parseRecipeFrontmatter(yamlText);

  const kind = String(fm.kind ?? "");
  if (kind && kind !== "team") {
    return NextResponse.json({ ok: false, error: `recipe kind must be team (got ${kind})` }, { status: 400 });
  }

  let result: { nextAgents: Array<Record<string, unknown>>; nextTemplates: Record<string, unknown>; addedRole: string | null } | NextResponse;

  if (op === "remove") {
    const role = normalizeRole(String(body.role ?? ""));
    result = handleRemove(agents, templates, role);
  } else if (op === "add") {
    const role = normalizeRole(String(body.role ?? ""));
    result = handleAdd(agents, templates, role, name);
  } else {
    const baseRole = normalizeRole(String(body.baseRole ?? ""));
    const teamId = String(body.teamId ?? "").trim();
    result = await handleAddLike(agents, templates, baseRole, name, teamId);
  }

  if (result instanceof NextResponse) return result;

  const { nextAgents, nextTemplates, addedRole } = result;
  nextAgents.sort((a, b) => String(a.role ?? "").localeCompare(String(b.role ?? "")));

  const nextMd = buildNextMarkdown(fm, nextAgents, nextTemplates, rest);
  await fs.writeFile(filePath, nextMd, "utf8");

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  const addedAgentId = teamId && addedRole ? `${teamId}-${addedRole}` : null;

  return NextResponse.json({
    ok: true,
    recipeId,
    filePath,
    agents: nextAgents,
    content: nextMd,
    addedRole,
    addedAgentId,
  });
}
