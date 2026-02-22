import path from "node:path";

export function parseTeamRoleWorkspace(ws: string):
  | { kind: "teamRole"; teamDir: string; teamId: string; roleDir: string; role: string }
  | { kind: "other" } {
  const normalized = ws.replace(/\\/g, "/");
  const m = normalized.match(/^(.*\/workspace-([^\/]+))\/roles\/([^\/]+)\/?$/);
  if (!m) return { kind: "other" };
  const teamDir = m[1];
  const teamId = m[2];
  const role = m[3];
  const roleDir = path.join(teamDir, "roles", role);
  return { kind: "teamRole", teamDir, teamId, roleDir, role };
}
