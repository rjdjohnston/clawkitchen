import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../agents/skills/install/route";

vi.mock("@/lib/openclaw", () => ({ runOpenClaw: vi.fn() }));
vi.mock("@/lib/agent-workspace", () => ({ parseTeamRoleWorkspace: vi.fn() }));

import { runOpenClaw } from "@/lib/openclaw";
import { parseTeamRoleWorkspace } from "@/lib/agent-workspace";

describe("api agents skills install route", () => {
  beforeEach(() => {
    vi.mocked(runOpenClaw).mockReset();
    vi.mocked(parseTeamRoleWorkspace).mockReturnValue({ kind: "agent" as const });
  });

  it("returns 400 when agentId missing", async () => {
    const res = await POST(
      new Request("https://test", { method: "POST", body: JSON.stringify({ skill: "foo" }) })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("agentId is required");
  });

  it("returns 400 when skill missing", async () => {
    const res = await POST(
      new Request("https://test", { method: "POST", body: JSON.stringify({ agentId: "a1" }) })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("skill is required");
  });

  it("returns 200 and installs at agent scope when not team role", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: "installed",
      stderr: "",
    });
    vi.mocked(runOpenClaw).mockResolvedValueOnce({
      ok: true,
      exitCode: 0,
      stdout: JSON.stringify([{ id: "a1", workspace: "/ws/a1" }]),
      stderr: "",
    });

    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ agentId: "a1", skill: "my-skill" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.agentId).toBe("a1");
    expect(json.skill).toBe("my-skill");
    expect(json.scopeArgs).toEqual([
      "recipes",
      "install-skill",
      "my-skill",
      "--agent-id",
      "a1",
      "--yes",
    ]);
  });

  it("installs at team scope when agent has teamRole workspace", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: "installed",
      stderr: "",
    });
    vi.mocked(runOpenClaw).mockResolvedValueOnce({
      ok: true,
      exitCode: 0,
      stdout: JSON.stringify([{ id: "a1", workspace: "workspace-team1/roles/lead" }]),
      stderr: "",
    });
    vi.mocked(parseTeamRoleWorkspace).mockReturnValue({
      kind: "teamRole" as const,
      teamId: "team1",
      role: "lead",
    });

    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ agentId: "a1", skill: "my-skill" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scopeArgs).toEqual([
      "recipes",
      "install-skill",
      "my-skill",
      "--team-id",
      "team1",
      "--yes",
    ]);
  });

  it("returns 500 when runOpenClaw fails", async () => {
    vi.mocked(runOpenClaw).mockResolvedValueOnce({
      ok: true,
      exitCode: 0,
      stdout: JSON.stringify([{ id: "a1" }]),
      stderr: "",
    });
    vi.mocked(runOpenClaw).mockResolvedValueOnce({
      ok: false,
      exitCode: 1,
      stdout: "stdout msg",
      stderr: "stderr msg",
    });

    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ agentId: "a1", skill: "bad-skill" }),
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("stderr msg");
  });
});
