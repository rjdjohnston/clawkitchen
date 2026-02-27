import { describe, expect, it } from "vitest";
import { parseTeamRoleWorkspace } from "../agent-workspace";

describe("agent-workspace", () => {
  describe("parseTeamRoleWorkspace", () => {
    it("returns teamRole for valid workspace path", () => {
      const ws = "/home/user/.openclaw/workspace-myteam/roles/lead";
      const result = parseTeamRoleWorkspace(ws);
      expect(result).toEqual({
        kind: "teamRole",
        teamDir: "/home/user/.openclaw/workspace-myteam",
        teamId: "myteam",
        roleDir: "/home/user/.openclaw/workspace-myteam/roles/lead",
        role: "lead",
      });
    });

    it("returns teamRole with trailing slash", () => {
      const ws = "/path/workspace-team1/roles/dev/";
      const result = parseTeamRoleWorkspace(ws);
      expect(result).toEqual({
        kind: "teamRole",
        teamDir: "/path/workspace-team1",
        teamId: "team1",
        roleDir: "/path/workspace-team1/roles/dev",
        role: "dev",
      });
    });

    it("returns other for non-team-role path", () => {
      expect(parseTeamRoleWorkspace("/some/other/path")).toEqual({ kind: "other" });
      expect(parseTeamRoleWorkspace("/workspace-x/agents/y")).toEqual({ kind: "other" });
      expect(parseTeamRoleWorkspace("")).toEqual({ kind: "other" });
    });

    it("normalizes backslashes to forward slashes", () => {
      const ws = "C:\\Users\\x\\.openclaw\\workspace-t1\\roles\\lead";
      const result = parseTeamRoleWorkspace(ws);
      expect(result.kind).toBe("teamRole");
      expect((result as { teamId: string }).teamId).toBe("t1");
      expect((result as { role: string }).role).toBe("lead");
    });
  });
});
