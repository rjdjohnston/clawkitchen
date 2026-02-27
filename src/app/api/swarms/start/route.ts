import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { errorMessage } from "@/lib/errors";
import { getKitchenApi } from "@/lib/kitchen-api";
import { normalizeId, resolveAgentWorkspace } from "@/lib/swarms";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      orchestratorAgentId?: string;
      agentId?: string; // compat
      taskId?: string;
      spec?: string;
      specFile?: string;
      baseRef?: string;
      branch?: string;
      tmuxSession?: string;
      agent?: "codex" | "claude";
      model?: string;
      reasoning?: "low" | "medium" | "high";
      timeoutMs?: number;
    };

    const orchestratorAgentId = normalizeId("orchestratorAgentId", String(body.orchestratorAgentId ?? body.agentId ?? ""));
    const taskId = normalizeId("taskId", String(body.taskId ?? ""));

    const spec = typeof body.spec === "string" ? body.spec : "";
    const specFile = typeof body.specFile === "string" ? body.specFile : "";
    if (!!spec === !!specFile) {
      throw new Error("Provide exactly one of spec or specFile");
    }

    const orchestratorWs = await resolveAgentWorkspace(orchestratorAgentId);
    const cliPath = path.join(orchestratorWs, ".clawdbot", "task.sh");

    // Prefer spec-file to avoid shell quoting surprises.
    let effectiveSpecFile = specFile;
    let tmpToCleanup: string | null = null;

    if (spec) {
      const tmp = path.join(os.tmpdir(), `clawkitchen-swarm-${taskId}-${Date.now()}.md`);
      await fs.writeFile(tmp, spec, "utf8");
      effectiveSpecFile = tmp;
      tmpToCleanup = tmp;
    }

    // Basic existence checks for actionable errors.
    await fs.access(cliPath);

    const timeoutMs = Number.isFinite(body.timeoutMs) ? Number(body.timeoutMs) : 120000;

    const args: string[] = [
      "bash",
      cliPath,
      "start",
      "--task-id",
      taskId,
      "--spec-file",
      effectiveSpecFile,
    ];

    if (typeof body.baseRef === "string" && body.baseRef.trim()) {
      args.push("--base-ref", body.baseRef.trim());
    }
    if (typeof body.branch === "string" && body.branch.trim()) {
      args.push("--branch", body.branch.trim());
    }
    if (typeof body.tmuxSession === "string" && body.tmuxSession.trim()) {
      args.push("--tmux-session", body.tmuxSession.trim());
    }
    if (typeof body.agent === "string" && body.agent.trim()) {
      args.push("--agent", body.agent.trim());
    }
    if (typeof body.model === "string" && body.model.trim()) {
      args.push("--model", body.model.trim());
    }
    if (typeof body.reasoning === "string" && body.reasoning.trim()) {
      args.push("--reasoning", body.reasoning.trim());
    }

    const api = getKitchenApi();
    const res = await api.runtime.system.runCommandWithTimeout(args, { timeoutMs });

    // best-effort tmp cleanup (fire-and-forget)
    if (tmpToCleanup) {
      fs.unlink(tmpToCleanup).catch(() => {});
    }

    return NextResponse.json({ ok: true, orchestratorWorkspace: orchestratorWs, stdout: res.stdout, stderr: res.stderr });
  } catch (err: unknown) {
    const msg = errorMessage(err);
    const isClientError = /required|match \//i.test(msg) || msg.includes("Provide exactly one");
    const status = isClientError ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
