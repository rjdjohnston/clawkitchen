import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../swarms/status/route";

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
    readFile: vi.fn().mockResolvedValue(JSON.stringify({ agents: { defaults: { workspace: "/home" } } })),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("api swarms status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when orchestratorAgentId missing", async () => {
    const res = await GET(new Request("https://test"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/orchestratorAgentId.*required/i);
  });

  it("returns 200 when orchestratorAgentId provided", async () => {
    const res = await GET(
      new Request("https://test?orchestratorAgentId=team1-swarm-orchestrator")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.orchestratorWorkspace).toBeDefined();
  });
});
