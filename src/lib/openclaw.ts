import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type OpenClawExecResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function runOpenClaw(args: string[]): Promise<OpenClawExecResult> {
  // Use execFile (no shell) for safety.
  try {
    const { stdout, stderr } = await execFileAsync("openclaw", args, {
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    return { ok: true, exitCode: 0, stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" };
  } catch (e: unknown) {
    // execFile throws on non-zero exit; it often includes stdout/stderr.
    const err = e as { code?: unknown; stdout?: unknown; stderr?: unknown; message?: unknown };
    const exitCode = typeof err.code === "number" ? err.code : 1;

    const stdout =
      typeof err.stdout === "string" ? err.stdout : err.stdout && typeof err.stdout === "object" && "toString" in err.stdout
        ? String((err.stdout as { toString: () => string }).toString())
        : "";

    const stderr =
      typeof err.stderr === "string"
        ? err.stderr
        : err.stderr && typeof err.stderr === "object" && "toString" in err.stderr
          ? String((err.stderr as { toString: () => string }).toString())
          : typeof err.message === "string"
            ? err.message
            : String(e);

    return { ok: false, exitCode, stdout, stderr };
  }
}
