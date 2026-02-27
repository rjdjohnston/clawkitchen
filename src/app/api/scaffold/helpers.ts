import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { runOpenClaw } from "@/lib/openclaw";
import { readOpenClawConfig, getWorkspaceRecipesDir } from "@/lib/paths";
import { NextResponse } from "next/server";

const TEAM_META_FILE = "team.json";
const AGENT_META_FILE = "agent.json";

function teamDirFromTeamId(baseWorkspace: string, teamId: string) {
  return path.resolve(baseWorkspace, "..", `workspace-${teamId}`);
}

export async function validateAgentId(
  agentId: string,
  recipeIds: Set<string>
): Promise<NextResponse | null> {
  if (!agentId) return null;
  if (recipeIds.has(agentId)) {
    return NextResponse.json(
      { ok: false, error: `Agent id cannot match an existing recipe id: ${agentId}. Choose a new agent id.` },
      { status: 409 }
    );
  }
  const agentsRes = await runOpenClaw(["agents", "list", "--json"]);
  if (!agentsRes.ok) return null;
  try {
    const agents = JSON.parse(agentsRes.stdout) as Array<{ id?: unknown }>;
    const exists = agents.some((a) => String(a.id ?? "").trim() === agentId);
    if (exists) {
      return NextResponse.json(
        { ok: false, error: `Agent already exists: ${agentId}. Choose a new id or enable overwrite.` },
        { status: 409 }
      );
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export async function validateTeamId(
  teamId: string,
  recipeIds: Set<string>
): Promise<NextResponse | null> {
  if (!teamId) return null;
  if (recipeIds.has(teamId)) {
    return NextResponse.json(
      { ok: false, error: `Team id cannot match an existing recipe id: ${teamId}. Choose a new team id.` },
      { status: 409 }
    );
  }
  try {
    const cfg = await readOpenClawConfig();
    const baseWorkspace = String(cfg.agents?.defaults?.workspace ?? "").trim();
    if (baseWorkspace) {
      const teamDir = teamDirFromTeamId(baseWorkspace, teamId);
      const hasWorkspace = await fs.stat(teamDir).then(() => true).catch(() => false);
      if (hasWorkspace) {
        return NextResponse.json(
          { ok: false, error: `Team workspace already exists: ${teamId}. Choose a new id or enable overwrite.` },
          { status: 409 }
        );
      }
    }
  } catch {
    // ignore
  }
  const agentsRes = await runOpenClaw(["agents", "list", "--json"]);
  if (!agentsRes.ok) return null;
  try {
    const agents = JSON.parse(agentsRes.stdout) as Array<{ id?: unknown }>;
    const hasAgents = agents.some((a) => String(a.id ?? "").startsWith(`${teamId}-`));
    if (hasAgents) {
      return NextResponse.json(
        { ok: false, error: `Team agents already exist for team: ${teamId}. Choose a new id or enable overwrite.` },
        { status: 409 }
      );
    }
  } catch {
    // ignore
  }
  return null;
}

export async function withCronOverride<T>(
  override: "yes" | "no" | undefined,
  fn: () => Promise<T>
): Promise<T> {
  let prevCronInstallation: string | null = null;
  if (override === "yes" || override === "no") {
    const cfgPath = "plugins.entries.recipes.config.cronInstallation";
    const prev = await runOpenClaw(["config", "get", cfgPath]);
    prevCronInstallation = prev.stdout.trim() || null;
    const next = override === "yes" ? "on" : "off";
    await runOpenClaw(["config", "set", cfgPath, next]);
  }
  try {
    return await fn();
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

async function getRecipeName(recipeId: string): Promise<string | undefined> {
  try {
    const list = await runOpenClaw(["recipes", "list"]);
    if (!list.ok) return undefined;
    const items = JSON.parse(list.stdout) as Array<{ id?: string; name?: string }>;
    const hit = items.find((r) => String(r.id ?? "").trim() === recipeId);
    return String(hit?.name ?? "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function persistProvenance(opts: {
  id: string;
  idKey: "teamId" | "agentId";
  recipeId: string;
  recipeHash: string | null;
  dirResolver: (baseWorkspace: string) => string;
  metaFileName: string;
}): Promise<void> {
  try {
    const cfg = await readOpenClawConfig();
    const baseWorkspace = String(cfg.agents?.defaults?.workspace ?? "").trim();
    if (!baseWorkspace) return;

    const dir = opts.dirResolver(baseWorkspace);
    const recipeName = await getRecipeName(opts.recipeId);
    const now = new Date().toISOString();
    const meta = {
      [opts.idKey]: opts.id,
      recipeId: opts.recipeId,
      ...(recipeName ? { recipeName } : {}),
      ...(opts.recipeHash ? { recipeHash: opts.recipeHash } : {}),
      scaffoldedAt: now,
      attachedAt: now,
    };

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, opts.metaFileName), JSON.stringify(meta, null, 2) + "\n", "utf8");
  } catch {
    // best-effort only
  }
}

export async function persistTeamProvenance(
  teamId: string,
  recipeId: string,
  recipeHash: string | null
): Promise<void> {
  await persistProvenance({
    id: teamId,
    idKey: "teamId",
    recipeId,
    recipeHash,
    dirResolver: (base) => teamDirFromTeamId(base, teamId),
    metaFileName: TEAM_META_FILE,
  });

  // Best-effort: ensure team.teamId matches in generated recipe
  try {
    const cfg = await readOpenClawConfig();
    const baseWorkspace = String(cfg.agents?.defaults?.workspace ?? "").trim();
    if (!baseWorkspace) return;
    const recipesDir = await getWorkspaceRecipesDir();
    const recipePath = path.join(recipesDir, `${teamId}.md`);
    const md = await fs.readFile(recipePath, "utf8");
    if (md.startsWith("---\n")) {
      const end = md.indexOf("\n---\n", 4);
      if (end !== -1) {
        const yamlText = md.slice(4, end + 1);
        const rest = md.slice(end + 5);
        const fm = (YAML.parse(yamlText) ?? {}) as Record<string, unknown>;
        const nextFm: Record<string, unknown> = {
          ...fm,
          team: {
            ...(typeof fm.team === "object" && fm.team ? (fm.team as Record<string, unknown>) : {}),
            teamId,
          },
        };
        const nextYaml = YAML.stringify(nextFm).trimEnd();
        const nextMd = `---\n${nextYaml}\n---\n${rest}`;
        if (nextMd !== md) await fs.writeFile(recipePath, nextMd, "utf8");
      }
    }
  } catch {
    // ignore
  }
}

export async function persistAgentProvenance(
  agentId: string,
  recipeId: string,
  recipeHash: string | null
): Promise<void> {
  await persistProvenance({
    id: agentId,
    idKey: "agentId",
    recipeId,
    recipeHash,
    dirResolver: (base) => path.resolve(base, "agents", agentId),
    metaFileName: AGENT_META_FILE,
  });
}
