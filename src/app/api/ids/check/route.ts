import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { runOpenClaw } from "@/lib/openclaw";
import { readOpenClawConfig } from "@/lib/paths";

type Kind = "team" | "agent";

function normalizeId(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kind = normalizeId(url.searchParams.get("kind")) as Kind;
    const id = normalizeId(url.searchParams.get("id"));

    if (kind !== "team" && kind !== "agent") {
      return NextResponse.json({ ok: false, error: "kind must be team|agent" }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ ok: true, available: false, reason: "empty" });
    }

    // Disallow collisions with any recipe id.
    const recipesRes = await runOpenClaw(["recipes", "list"]);
    if (recipesRes.ok) {
      try {
        const items = JSON.parse(recipesRes.stdout) as Array<{ id?: unknown }>;
        const ids = new Set(items.map((r) => normalizeId(r.id)).filter(Boolean));
        if (ids.has(id)) {
          return NextResponse.json({ ok: true, available: false, reason: "recipe-id-collision" });
        }
      } catch {
        // ignore
      }
    }

    if (kind === "agent") {
      const agentsRes = await runOpenClaw(["agents", "list", "--json"]);
      if (agentsRes.ok) {
        try {
          const agents = JSON.parse(agentsRes.stdout) as Array<{ id?: unknown }>;
          const exists = agents.some((a) => normalizeId(a.id) === id);
          if (exists) return NextResponse.json({ ok: true, available: false, reason: "agent-exists" });
        } catch {
          // ignore
        }
      }

      return NextResponse.json({ ok: true, available: true });
    }

    // Team id: check team workspace dir and any team agents prefix.
    try {
      const cfg = await readOpenClawConfig();
      const baseWorkspace = normalizeId(cfg.agents?.defaults?.workspace);
      if (baseWorkspace) {
        const teamDir = path.resolve(baseWorkspace, "..", `workspace-${id}`);
        const hasDir = await fs
          .stat(teamDir)
          .then(() => true)
          .catch(() => false);
        if (hasDir) return NextResponse.json({ ok: true, available: false, reason: "team-workspace-exists" });
      }
    } catch {
      // ignore
    }

    const agentsRes = await runOpenClaw(["agents", "list", "--json"]);
    if (agentsRes.ok) {
      try {
        const agents = JSON.parse(agentsRes.stdout) as Array<{ id?: unknown }>;
        const hasAgents = agents.some((a) => normalizeId(a.id).startsWith(`${id}-`));
        if (hasAgents) return NextResponse.json({ ok: true, available: false, reason: "team-agents-exist" });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ ok: true, available: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
