import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveAgentWorkspace } from "@/lib/agents";
import { errorMessage } from "@/lib/errors";
import { readOpenClawConfig, teamDirFromBaseWorkspace } from "@/lib/paths";

export type TeamContext = { teamId: string; teamDir: string };

/** Error response for install-skill openclaw failures. Use when runOpenClaw returns !ok. */
export function installSkillErrorResponse(
  args: string[],
  res: { stdout?: string; stderr?: string; exitCode?: number },
  extra?: Record<string, unknown>
): NextResponse {
  const stdout = res.stdout?.trim();
  const stderr = res.stderr?.trim();
  return NextResponse.json(
    {
      ok: false,
      error: stderr || stdout || `openclaw ${args.join(" ")} failed (exit=${res.exitCode})`,
      stdout: res.stdout,
      stderr: res.stderr,
      ...extra,
    },
    { status: 500 }
  );
}

async function resolveTeamContext(teamId: string): Promise<TeamContext | NextResponse> {
  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });

  const cfg = await readOpenClawConfig();
  const baseWorkspace = String(cfg.agents?.defaults?.workspace ?? "").trim();
  if (!baseWorkspace) {
    return NextResponse.json({ ok: false, error: "agents.defaults.workspace not set" }, { status: 500 });
  }

  const teamDir = teamDirFromBaseWorkspace(baseWorkspace, teamId);
  return { teamId, teamDir };
}

/** Resolves teamId and teamDir from URL search params. Returns error response if invalid. */
export async function getTeamContextFromQuery(req: Request): Promise<TeamContext | NextResponse> {
  const { searchParams } = new URL(req.url);
  const teamId = String(searchParams.get("teamId") ?? "").trim();
  return resolveTeamContext(teamId);
}

/** Runs handler with team context from query; returns error response if context invalid. */
export async function withTeamContextFromQuery(
  req: Request,
  handler: (ctx: TeamContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const ctx = await getTeamContextFromQuery(req);
  if (ctx instanceof NextResponse) return ctx;
  return handler(ctx);
}

/** Resolves teamId and teamDir from parsed body. Caller must parse req.json() first. */
export async function getTeamContextFromBody(body: { teamId?: string }): Promise<TeamContext | NextResponse> {
  const teamId = String(body.teamId ?? "").trim();
  return resolveTeamContext(teamId);
}

export type AgentContext = { agentId: string; ws: string };

/** Resolves agentId and workspace from URL search params. Returns error response if invalid. */
export async function getAgentContextFromQuery(req: Request): Promise<AgentContext | NextResponse> {
  const { searchParams } = new URL(req.url);
  const agentId = String(searchParams.get("agentId") ?? "").trim();
  return resolveAgentContext(agentId);
}

/** Resolves agentId and workspace from parsed body. Caller must parse req.json() first. */
export async function getAgentContextFromBody(body: { agentId?: string }): Promise<AgentContext | NextResponse> {
  const agentId = String(body.agentId ?? "").trim();
  return resolveAgentContext(agentId);
}

async function resolveAgentContext(agentId: string): Promise<AgentContext | NextResponse> {
  if (!agentId) return NextResponse.json({ ok: false, error: "agentId is required" }, { status: 400 });
  try {
    const ws = await resolveAgentWorkspace(agentId);
    return { agentId, ws };
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 404 });
  }
}

export type FileCandidate = { name: string; required: boolean; rationale: string };

/** Lists workspace files with presence/size info. */
export async function listWorkspaceFiles(
  baseDir: string,
  candidates: FileCandidate[]
): Promise<
  Array<{
    name: string;
    required: boolean;
    rationale: string;
    path: string;
    missing: boolean;
    size?: number;
    updatedAtMs?: number;
  }>
> {
  return Promise.all(
    candidates.map(async (c) => {
      const p = path.join(baseDir, c.name);
      try {
        const st = await fs.stat(p);
        return {
          name: c.name,
          required: c.required,
          rationale: c.rationale,
          path: p,
          missing: false,
          size: st.size,
          updatedAtMs: st.mtimeMs,
        };
      } catch {
        return { name: c.name, required: c.required, rationale: c.rationale, path: p, missing: true };
      }
    })
  );
}
