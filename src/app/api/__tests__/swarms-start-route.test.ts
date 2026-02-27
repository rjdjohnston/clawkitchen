import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../swarms/start/route";

vi.mock("@/lib/kitchen-api", () => ({
  getKitchenApi: vi.fn(() => ({
    runtime: {
      system: {
        runCommandWithTimeout: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
      },
    },
  })),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("api swarms start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when orchestratorAgentId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ taskId: "t1", spec: "do something" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/orchestratorAgentId.*required/i);
  });

  it("returns 400 when taskId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ orchestratorAgentId: "team1-swarm-orchestrator", spec: "do something" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/taskId.*required/i);
  });

  it("returns 400 when neither spec nor specFile provided", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ orchestratorAgentId: "team1-swarm-orchestrator", taskId: "t1" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/spec|specFile/i);
  });

  it("returns 400 when both spec and specFile provided", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({
          orchestratorAgentId: "team1-swarm-orchestrator",
          taskId: "t1",
          spec: "x",
          specFile: "/home/test/x.md",
        }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/exactly one/i);
  });
});
