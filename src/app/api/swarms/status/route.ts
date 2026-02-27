import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { errorMessage } from "@/lib/errors";
import { getKitchenApi } from "@/lib/kitchen-api";
import { normalizeId, resolveAgentWorkspace } from "@/lib/swarms";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orchestratorAgentId = normalizeId(
      "orchestratorAgentId",
      url.searchParams.get("orchestratorAgentId") || url.searchParams.get("agentId") || "",
    );

    const orchestratorWs = await resolveAgentWorkspace(orchestratorAgentId);
    const cliPath = path.join(orchestratorWs, ".clawdbot", "task.sh");
    await fs.access(cliPath);

    const api = getKitchenApi();
    const res = await api.runtime.system.runCommandWithTimeout(["bash", cliPath, "status"], { timeoutMs: 30000 });

    return NextResponse.json({ ok: true, orchestratorWorkspace: orchestratorWs, stdout: res.stdout, stderr: res.stderr });
  } catch (err: unknown) {
    const msg = errorMessage(err);
    const status = /required|match \//i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
