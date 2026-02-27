import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ runOpenClaw: vi.fn() }));
vi.mock("@/lib/paths", () => ({ readOpenClawConfig: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  default: { stat: vi.fn() },
}));

import { runOpenClaw } from "@/lib/openclaw";
import { readOpenClawConfig } from "@/lib/paths";
import fs from "node:fs/promises";

describe("api ids check route", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.advanceTimersByTime(15_000);
    vi.mocked(runOpenClaw).mockReset();
    vi.mocked(readOpenClawConfig).mockReset();
    vi.mocked(fs.stat).mockReset();
    const mod = await import("../ids/check/route");
    GET = mod.GET;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 400 when kind invalid", async () => {
    const res = await GET(new Request("https://test/api/ids/check?kind=invalid&id=foo"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("kind must be team|agent");
  });

  it("returns available:false reason:empty when id empty", async () => {
    const res = await GET(new Request("https://test/api/ids/check?kind=agent&id="));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.available).toBe(false);
    expect(json.reason).toBe("empty");
  });

  it("returns available:false reason:recipe-id-collision when id collides with recipe", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([{ id: "foo" }]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      });

    const res = await GET(new Request("https://test/api/ids/check?kind=agent&id=foo"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("recipe-id-collision");
  });

  it("returns available:false reason:agent-exists for agent id", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([{ id: "my-agent" }]),
        stderr: "",
      });

    const res = await GET(new Request("https://test/api/ids/check?kind=agent&id=my-agent"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("agent-exists");
  });

  it("returns available:true for new agent id", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      });

    const res = await GET(new Request("https://test/api/ids/check?kind=agent&id=new-agent"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(true);
  });

  it("returns available:false reason:team-workspace-exists when team dir exists", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      });
    vi.mocked(readOpenClawConfig).mockResolvedValue({
      agents: { defaults: { workspace: "/home/user/agents" } },
    } as never);
    vi.mocked(fs.stat).mockResolvedValue({} as never);

    const res = await GET(new Request("https://test/api/ids/check?kind=team&id=my-team"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("team-workspace-exists");
  });

  it("returns available:false reason:team-agents-exist when agents with prefix exist", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([{ id: "my-team-lead" }]),
        stderr: "",
      });
    vi.mocked(readOpenClawConfig).mockResolvedValue({
      agents: { defaults: { workspace: "/home/user/agents" } },
    } as never);
    vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));

    const res = await GET(new Request("https://test/api/ids/check?kind=team&id=my-team"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("team-agents-exist");
  });

  it("returns available:true for new team id", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      });
    vi.mocked(readOpenClawConfig).mockResolvedValue({
      agents: { defaults: { workspace: "/home/user/agents" } },
    } as never);
    vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));

    const res = await GET(new Request("https://test/api/ids/check?kind=team&id=new-team"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(true);
  });
});
