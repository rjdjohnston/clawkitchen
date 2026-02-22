import { getKitchenApi } from "@/lib/kitchen-api";

export type OpenClawExecResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function runOpenClaw(args: string[]): Promise<OpenClawExecResult> {
  // Avoid child_process usage in plugin code (triggers OpenClaw install-time safety warnings).
  // Delegate to the OpenClaw runtime helper instead.
  const api = getKitchenApi();

  try {
    const res = (await api.runtime.system.runCommandWithTimeout(["openclaw", ...args], { timeoutMs: 120000 })) as {
      stdout?: unknown;
      stderr?: unknown;
      exitCode?: unknown;
      code?: unknown;
      status?: unknown;
    };

    const stdout = String(res.stdout ?? "");
    const stderr = String(res.stderr ?? "");
    const exitCode =
      typeof res.exitCode === "number"
        ? res.exitCode
        : typeof res.code === "number"
          ? res.code
          : typeof res.status === "number"
            ? res.status
            : 0;

    if (exitCode !== 0) return { ok: false, exitCode, stdout, stderr };
    return { ok: true, exitCode: 0, stdout, stderr };
  } catch (e: unknown) {
    const err = e as { code?: unknown; stdout?: unknown; stderr?: unknown; message?: unknown };
    const exitCode = typeof err.code === "number" ? err.code : 1;
    const stdout = typeof err.stdout === "string" ? err.stdout : "";
    const stderr = typeof err.stderr === "string" ? err.stderr : typeof err.message === "string" ? err.message : String(e);
    return { ok: false, exitCode, stdout, stderr };
  }
}
