import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../teams/skills/install/route";

vi.mock("@/lib/openclaw", () => ({ runOpenClaw: vi.fn() }));
import { runOpenClaw } from "@/lib/openclaw";

describe("api teams skills install route", () => {
  beforeEach(() => {
    vi.mocked(runOpenClaw).mockReset();
  });

  it("returns 400 when teamId missing", async () => {
    const res = await POST(
      new Request("https://test", { method: "POST", body: JSON.stringify({ skill: "foo" }) })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("teamId is required");
  });

  it("returns 400 when skill missing", async () => {
    const res = await POST(
      new Request("https://test", { method: "POST", body: JSON.stringify({ teamId: "t1" }) })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("skill is required");
  });

  it("returns 200 and installs skill for team", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: "installed",
      stderr: "",
    });

    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ teamId: "t1", skill: "my-skill" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.teamId).toBe("t1");
    expect(json.skill).toBe("my-skill");
    expect(runOpenClaw).toHaveBeenCalledWith([
      "recipes",
      "install-skill",
      "my-skill",
      "--team-id",
      "t1",
      "--yes",
    ]);
  });

  it("returns 500 when runOpenClaw fails", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: false,
      exitCode: 1,
      stdout: "stdout msg",
      stderr: "stderr msg",
    });

    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ teamId: "t1", skill: "bad-skill" }),
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("stderr msg");
  });
});
