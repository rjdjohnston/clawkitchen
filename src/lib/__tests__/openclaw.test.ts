import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runOpenClaw } from "../openclaw";

const mockRunCommand = vi.hoisted(() => vi.fn());

describe("openclaw", () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    (globalThis as unknown as { __clawkitchen_api?: unknown }).__clawkitchen_api = {
      runtime: {
        system: {
          runCommandWithTimeout: mockRunCommand,
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { __clawkitchen_api?: unknown }).__clawkitchen_api;
  });

  describe("runOpenClaw", () => {
    it("returns ok true when exit is 0", async () => {
      mockRunCommand.mockResolvedValue({
        stdout: "stdout\n",
        stderr: "stderr",
        exitCode: 0,
      });

      const result = await runOpenClaw(["recipes", "list"]);
      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("stdout\n");
      expect(result.stderr).toBe("stderr");
    });

    it("returns ok false with stdout/stderr on non-zero exit", async () => {
      const err = new Error("Command failed") as Error & { code?: number; stdout?: string; stderr?: string };
      err.code = 1;
      err.stdout = "out";
      err.stderr = "err";

      mockRunCommand.mockRejectedValue(err);

      const result = await runOpenClaw(["bad", "cmd"]);
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("out");
      expect(result.stderr).toBe("err");
    });

    it("uses err.message as stderr fallback when stderr missing", async () => {
      const err = new Error("Something went wrong") as Error & { code?: number };
      err.code = 2;

      mockRunCommand.mockRejectedValue(err);

      const result = await runOpenClaw(["fail"]);
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe("Something went wrong");
    });

    it("uses numeric code from error", async () => {
      const err = new Error("fail") as Error & { code?: number };
      err.code = 42;

      mockRunCommand.mockRejectedValue(err);

      const result = await runOpenClaw(["x"]);
      expect(result.exitCode).toBe(42);
    });

    it("defaults exitCode to 1 when code not numeric", async () => {
      const err = new Error("fail");

      mockRunCommand.mockRejectedValue(err);

      const result = await runOpenClaw(["x"]);
      expect(result.exitCode).toBe(1);
    });

    it("extracts stdout from object with toString when rejected", async () => {
      const err = new Error("fail") as Error & { code?: number; stdout?: unknown };
      err.code = 1;
      err.stdout = { toString: () => "custom-out" };

      mockRunCommand.mockRejectedValue(err);

      const result = await runOpenClaw(["x"]);
      expect(result.stdout).toBe("custom-out");
    });

    it("extracts stderr from object with toString when rejected", async () => {
      const err = new Error("fail") as Error & { code?: number; stderr?: unknown };
      err.code = 1;
      err.stderr = { toString: () => "custom-err" };

      mockRunCommand.mockRejectedValue(err);

      const result = await runOpenClaw(["x"]);
      expect(result.stderr).toBe("custom-err");
    });

    it("uses code from result when exitCode missing", async () => {
      mockRunCommand.mockResolvedValue({
        stdout: "",
        stderr: "",
        code: 2,
      });

      const result = await runOpenClaw(["x"]);
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it("uses status from result when exitCode and code missing", async () => {
      mockRunCommand.mockResolvedValue({
        stdout: "",
        stderr: "",
        status: 3,
      });

      const result = await runOpenClaw(["x"]);
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(3);
    });
  });
});
