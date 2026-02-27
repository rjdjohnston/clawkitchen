import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getTeamContextFromQuery,
  getTeamContextFromBody,
  jsonOkRest,
  listWorkspaceFiles,
  installSkillErrorResponse,
  parseJsonBody,
} from "../api-route-helpers";

vi.mock("@/lib/paths", () => ({
  readOpenClawConfig: vi.fn(),
  teamDirFromBaseWorkspace: vi.fn((base: string, teamId: string) => `${base}/../workspace-${teamId}`),
}));

import { readOpenClawConfig } from "@/lib/paths";
import fs from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  default: { stat: vi.fn() },
}));

describe("api-route-helpers", () => {
  beforeEach(() => {
    vi.mocked(readOpenClawConfig).mockReset();
  });

  describe("getTeamContextFromQuery", () => {
    it("returns 400 when teamId missing", async () => {
      const res = await getTeamContextFromQuery(new Request("https://test/api/teams/files"));
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(400);
      const json = await (res as Response).json();
      expect(json.error).toBe("teamId is required");
    });

    it("returns 500 when workspace not set", async () => {
      vi.mocked(readOpenClawConfig).mockResolvedValue({});
      const res = await getTeamContextFromQuery(new Request("https://test?teamId=my-team"));
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(500);
      const json = await (res as Response).json();
      expect(json.error).toBe("agents.defaults.workspace not set");
    });

    it("returns team context when valid", async () => {
      vi.mocked(readOpenClawConfig).mockResolvedValue({
        agents: { defaults: { workspace: "/home/x/agents" } },
      });
      const res = await getTeamContextFromQuery(new Request("https://test?teamId=my-team"));
      expect(res).not.toBeInstanceOf(Response);
      expect(res).toEqual({
        teamId: "my-team",
        teamDir: "/home/x/agents/../workspace-my-team",
      });
    });
  });

  describe("parseJsonBody", () => {
    it("returns body object when JSON valid", async () => {
      const req = new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ teamId: "t1", x: 1 }),
        headers: { "content-type": "application/json" },
      });
      const result = await parseJsonBody(req);
      expect(result).not.toBeInstanceOf(Response);
      expect((result as { body: Record<string, unknown> }).body).toEqual({ teamId: "t1", x: 1 });
    });

    it("returns 400 when JSON invalid", async () => {
      const req = new Request("https://test", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      });
      const result = await parseJsonBody(req);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(400);
      const json = await (result as Response).json();
      expect(json.error).toBe("Invalid JSON");
    });
  });

  describe("jsonOkRest", () => {
    it("returns NextResponse.json with ok:true and rest of object", async () => {
      const res = jsonOkRest({ ok: true, path: "/a/b", workflow: { id: "w1", name: "W" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.path).toBe("/a/b");
      expect(json.workflow).toEqual({ id: "w1", name: "W" });
    });

    it("omits ok from rest when input has ok:false", async () => {
      const res = jsonOkRest({ ok: false, error: "x" });
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.error).toBe("x");
    });
  });

  describe("installSkillErrorResponse", () => {
    it("returns 500 JSON with error from stderr", async () => {
      const res = installSkillErrorResponse(
        ["recipes", "install-skill", "foo", "--agent-id", "a1", "--yes"],
        { stdout: "out", stderr: "err", exitCode: 1 }
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("err");
      expect(json.stdout).toBe("out");
      expect(json.stderr).toBe("err");
    });

    it("falls back to stdout when stderr empty", async () => {
      const res = installSkillErrorResponse(["recipes", "install-skill", "x"], { stdout: "stdout", stderr: "", exitCode: 2 });
      const json = await res.json();
      expect(json.error).toBe("stdout");
    });

    it("includes extra fields when provided", async () => {
      const res = installSkillErrorResponse(["x"], { stdout: "", stderr: "fail" }, { scopeArgs: ["a", "b"] });
      const json = await res.json();
      expect(json.scopeArgs).toEqual(["a", "b"]);
    });
  });

  describe("getTeamContextFromBody", () => {
    it("returns 400 when teamId missing", async () => {
      const res = await getTeamContextFromBody({});
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(400);
    });

    it("returns team context when valid", async () => {
      vi.mocked(readOpenClawConfig).mockResolvedValue({
        agents: { defaults: { workspace: "/ws" } },
      });
      const res = await getTeamContextFromBody({ teamId: "t1" });
      expect(res).toEqual({ teamId: "t1", teamDir: "/ws/../workspace-t1" });
    });
  });

  describe("listWorkspaceFiles", () => {
    beforeEach(() => {
      vi.mocked(fs.stat).mockReset();
    });

    it("returns file info for existing files", async () => {
      vi.mocked(fs.stat).mockResolvedValue({ size: 100, mtimeMs: 123 } as never);

      const result = await listWorkspaceFiles("/base", [
        { name: "a.md", required: true, rationale: "A" },
        { name: "b.md", required: false, rationale: "B" },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "a.md",
        required: true,
        rationale: "A",
        path: "/base/a.md",
        missing: false,
        size: 100,
        updatedAtMs: 123,
      });
      expect(result[1].missing).toBe(false);
    });

    it("marks missing files", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));

      const result = await listWorkspaceFiles("/base", [
        { name: "missing.md", required: true, rationale: "M" },
      ]);

      expect(result[0]).toEqual({
        name: "missing.md",
        required: true,
        rationale: "M",
        path: "/base/missing.md",
        missing: true,
      });
    });
  });
});
