import { describe, expect, it, vi, beforeEach } from "vitest";
import { DELETE } from "../agents/[id]/route";

vi.mock("@/lib/openclaw", () => ({ runOpenClaw: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn(), rename: vi.fn(), rm: vi.fn() },
}));

import { runOpenClaw } from "@/lib/openclaw";

describe("api agents [id] route", () => {
  beforeEach(() => {
    vi.mocked(runOpenClaw).mockReset();
  });

  it("returns 400 when id missing", async () => {
    const res = await DELETE(
      new Request("https://test", { method: "DELETE" }),
      { params: Promise.resolve({ id: "" }) }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("agent id is required");
  });

  it("returns 500 when runOpenClaw fails", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "Agent not found",
    });

    const res = await DELETE(
      new Request("https://test", { method: "DELETE" }),
      { params: Promise.resolve({ id: "my-agent" }) }
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to delete agent: my-agent");
    expect(json.stderr).toBe("Agent not found");
  });

  it("returns ok on success", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: JSON.stringify({ deleted: true }),
      stderr: "",
    });

    const res = await DELETE(
      new Request("https://test", { method: "DELETE" }),
      { params: Promise.resolve({ id: "my-agent" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result).toEqual({ deleted: true });
  });

  it("returns ok with raw stdout when JSON parse fails", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: "plain text",
      stderr: "",
    });

    const res = await DELETE(
      new Request("https://test", { method: "DELETE" }),
      { params: Promise.resolve({ id: "my-agent" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result).toBe("plain text");
  });

  it("moves team role to trash when agent has workspace", async () => {
    vi.mocked(runOpenClaw)
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify([
          { id: "team1-role1", workspace: "/var/workspace/workspace-team1/roles/role1" },
        ]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: JSON.stringify({ deleted: true }),
        stderr: "",
      });

    const res = await DELETE(
      new Request("https://test", { method: "DELETE" }),
      { params: Promise.resolve({ id: "team1-role1" }) }
    );
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });
});
