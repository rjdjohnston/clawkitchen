import { NextResponse } from "next/server";
import { toolsInvoke } from "@/lib/gateway";

type CronToolResult = {
  content: Array<{ type: string; text?: string }>;
};

import fs from "node:fs/promises";
import path from "node:path";
import { getTeamWorkspaceDir } from "@/lib/paths";
import { runOpenClaw } from "@/lib/openclaw";

function hrefForScope(scope: { kind: "team" | "agent"; id: string }) {
  return scope.kind === "team" ? `/teams/${encodeURIComponent(scope.id)}` : `/agents/${encodeURIComponent(scope.id)}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = String(url.searchParams.get("teamId") ?? "").trim();

    const result = await toolsInvoke<CronToolResult>({
      tool: "cron",
      args: { action: "list", includeDisabled: true },
    });

    // Tool responses may come back as either:
    // - {type:"text", text:"{...}"} (stringified JSON)
    // - {type:"json", json:{...}} (already-parsed)
    const text = result?.content?.find((c) => c.type === "text")?.text;
    const jsonPayload = (result?.content as Array<{ type: string; text?: string; json?: unknown }> | undefined)?.find(
      (c) => c.type === "json" && c.json,
    )?.json;

    const parsed = ((): { jobs?: unknown[] } => {
      if (jsonPayload && typeof jsonPayload === "object") return jsonPayload as { jobs?: unknown[] };
      if (text && text.trim()) return JSON.parse(text) as { jobs?: unknown[] };
      return { jobs: [] };
    })();

    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];

    // Enrich: map installed cron IDs → scope (team/agent) using provenance files.
    // This is best-effort; if anything fails, we still return raw jobs.
    const idToScope = new Map<string, { kind: "team" | "agent"; id: string; label: string; href: string }>();

    try {
      // Teams: scan known workspace-* directories for notes/cron-jobs.json
      // NOTE: This is not intended to be ultra-fast; cron-jobs page is admin tooling.
      const baseWorkspace = String((await (await import("@/lib/paths")).readOpenClawConfig()).agents?.defaults?.workspace ?? "").trim();
      const baseHome = path.resolve(baseWorkspace, "..");
      const entries = await fs.readdir(baseHome, { withFileTypes: true });

      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        if (!ent.name.startsWith("workspace-")) continue;
        const scopeId = ent.name.replace(/^workspace-/, "");
        const teamJsonPath = path.join(baseHome, ent.name, "team.json");
        const teamNotesCronPath = path.join(baseHome, ent.name, "notes", "cron-jobs.json");

        // If team.json exists, treat as a team workspace.
        try {
          await fs.stat(teamJsonPath);
        } catch {
          continue;
        }

        try {
          const raw = await fs.readFile(teamNotesCronPath, "utf8");
          const json = JSON.parse(raw) as { entries?: Record<string, { installedCronId?: unknown; orphaned?: unknown }> };
          const map = json.entries ?? {};
          for (const v of Object.values(map)) {
            if (v && !Boolean(v.orphaned)) {
              const id = String(v.installedCronId ?? "").trim();
              if (id) idToScope.set(id, { kind: "team", id: scopeId, label: scopeId, href: hrefForScope({ kind: "team", id: scopeId }) });
            }
          }
        } catch {
          // ignore
        }
      }

      // Agents: use OpenClaw config list to map agent workspaces and check for notes/cron-jobs.json
      try {
        const cfgText = await runOpenClaw(["config", "get", "agents.list", "--no-color"]);
        if (cfgText.ok) {
          const list = JSON.parse(String(cfgText.stdout ?? "[]")) as Array<{ id?: unknown; workspace?: unknown }>;
          for (const a of list) {
            const agentId = String(a.id ?? "");
            const workspace = String(a.workspace ?? "");
            if (!agentId || !workspace) continue;
            const cronPath = path.join(workspace, "notes", "cron-jobs.json");
            try {
              const raw = await fs.readFile(cronPath, "utf8");
              const json = JSON.parse(raw) as { entries?: Record<string, { installedCronId?: unknown; orphaned?: unknown }> };
              const map = json.entries ?? {};
              for (const v of Object.values(map)) {
                if (v && !Boolean(v.orphaned)) {
                  const id = String(v.installedCronId ?? "").trim();
                  if (id) idToScope.set(id, { kind: "agent", id: agentId, label: agentId, href: hrefForScope({ kind: "agent", id: agentId }) });
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }

    const enriched = jobs.map((j) => {
      const id = String((j as { id?: unknown }).id ?? "");
      const scope = id ? idToScope.get(id) : undefined;
      return scope ? { ...(j as object), scope } : j;
    });

    if (!teamId) {
      return NextResponse.json({ ok: true, jobs: enriched });
    }

    // If a teamId is provided, filter to only cron jobs installed for that team.
    // Source of truth is the team workspace provenance file written by scaffold-team.
    const teamDir = await getTeamWorkspaceDir(teamId);
    const provenancePath = path.join(teamDir, "notes", "cron-jobs.json");

    let installedIds: string[] = [];
    try {
      const text = await fs.readFile(provenancePath, "utf8");
      const json = JSON.parse(text) as { entries?: Record<string, { installedCronId?: unknown; orphaned?: unknown }> };
      const entries = json.entries ?? {};
      installedIds = Object.values(entries)
        .filter((e) => !Boolean(e.orphaned))
        .map((e) => String(e.installedCronId ?? "").trim())
        .filter(Boolean);
    } catch {
      installedIds = [];
    }

    const filtered = enriched.filter((j) => installedIds.includes(String((j as { id?: unknown }).id ?? "")));
    return NextResponse.json({ ok: true, jobs: filtered, teamId, provenancePath, installedIds });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
