import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../teams/orchestrator/install/route";

vi.mock("@/lib/openclaw", () => ({ runOpenClaw: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    chmod: vi.fn(),
  },
}));

import { runOpenClaw } from "@/lib/openclaw";

describe("api teams orchestrator install route", () => {
  beforeEach(() => {
    vi.mocked(runOpenClaw).mockReset();
  });

  it("returns 400 when teamId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({
          orchestratorAgentId: "team1-swarm-orchestrator",
          repoDir: "/home/test/repo",
        }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/teamId.*required/i);
  });

  it("returns 400 when orchestratorAgentId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({
          teamId: "team1",
          repoDir: "/home/test/repo",
        }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/orchestratorAgentId.*required/i);
  });

  it("returns 400 when repoDir missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({
          teamId: "team1",
          orchestratorAgentId: "team1-swarm-orchestrator",
        }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/repoDir.*required/i);
  });
});
