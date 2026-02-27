import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { getKitchenApi } from "@/lib/kitchen-api";

function normalizeId(kind: string, id: string) {
  const s = String(id ?? "").trim();
  if (!s) throw new Error(`${kind} is required`);
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(s)) {
    throw new Error(`${kind} must match /^[a-z0-9][a-z0-9-]{0,62}$/i`);
  }
  return s;
}

async function resolveOrchestratorWorkspace(orchestratorAgentId: string) {
  const cfgPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  const raw = await fs.readFile(cfgPath, "utf8");
  const cfg = JSON.parse(raw) as { agents?: { defaults?: { workspace?: string } } };

  const baseWorkspace = String(cfg?.agents?.defaults?.workspace ?? "").trim();
  if (!baseWorkspace) throw new Error("agents.defaults.workspace not set");

  return path.resolve(baseWorkspace, "..", `workspace-${orchestratorAgentId}`);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orchestratorAgentId = normalizeId(
      "orchestratorAgentId",
      url.searchParams.get("orchestratorAgentId") || url.searchParams.get("agentId") || "",
    );

    const orchestratorWs = await resolveOrchestratorWorkspace(orchestratorAgentId);
    const cliPath = path.join(orchestratorWs, ".clawdbot", "task.sh");
    await fs.access(cliPath);

    const api = getKitchenApi();
    const res = await api.runtime.system.runCommandWithTimeout(["bash", cliPath, "status"], { timeoutMs: 30000 });

    return NextResponse.json({ ok: true, orchestratorWorkspace: orchestratorWs, stdout: res.stdout, stderr: res.stderr });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /required|match \//i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
