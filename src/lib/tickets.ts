import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type TicketStage = "backlog" | "in-progress" | "testing" | "done";

export interface TicketSummary {
  teamId: string;
  number: number;
  id: string;
  title: string;
  owner: string | null;
  stage: TicketStage;
  file: string;
  updatedAt: string; // ISO
  ageHours: number;
}

/**
 * Team workspace resolution.
 *
 * - If `teamId` is provided: ~/.openclaw/workspace-<teamId>
 * - Else: CK_TEAM_WORKSPACE_DIR (if set)
 * - Else: CK_TEAM_ID (if set)
 * - Else: ~/.openclaw/workspace-development-team (back-compat)
 */
export function getTeamWorkspaceDir(teamId?: string): string {
  const home = os.homedir();
  if (!home) throw new Error("Could not resolve home directory");

  if (teamId) return path.join(home, ".openclaw", `workspace-${teamId}`);

  const ws = process.env.CK_TEAM_WORKSPACE_DIR;
  if (ws) return ws;

  const envTeamId = process.env.CK_TEAM_ID;
  if (envTeamId) return path.join(home, ".openclaw", `workspace-${envTeamId}`);

  return path.join(home, ".openclaw", "workspace-development-team");
}

export function stageDir(stage: TicketStage, teamDir: string = getTeamWorkspaceDir()): string {
  const map: Record<TicketStage, string> = {
    backlog: "work/backlog",
    "in-progress": "work/in-progress",
    testing: "work/testing",
    done: "work/done",
  };
  return path.join(teamDir, map[stage]);
}

export function parseTitle(md: string) {
  // Ticket markdown files typically start with: # 0033-some-slug
  const firstLine = md.split("\n")[0] ?? "";
  const header = firstLine.startsWith("# ") ? firstLine.slice(2).trim() : "";

  // If header is like: "<id> <title...>" keep the explicit title portion.
  const firstSpace = header.indexOf(" ");
  if (firstSpace > 0) {
    const afterSpace = header.slice(firstSpace + 1).trim();
    if (afterSpace) return afterSpace;
  }

  // Otherwise derive from the slug: strip leading number + hyphen, then de-kebab.
  const derivedRaw = header
    .replace(/^\d{4}-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ACRONYMS = new Set(["api", "cli", "ui", "ux", "gpu", "cpu", "npm", "pr", "ci", "cd", "json", "yaml", "md"]);
  const titleCase = (s: string) =>
    s
      .split(" ")
      .filter(Boolean)
      .map((w) => {
        const lower = w.toLowerCase();
        if (ACRONYMS.has(lower)) return w.toUpperCase();
        if (lower.startsWith("v") && /^\d/.test(lower.slice(1))) return w; // version-like
        if (/^[\d.]+$/.test(w)) return w; // numbers/semver
        return w.slice(0, 1).toUpperCase() + w.slice(1);
      })
      .join(" ");

  const derived = derivedRaw ? titleCase(derivedRaw) : "";

  if (derived) return derived;
  return header || "(untitled)";
}

function parseField(md: string, field: string): string | null {
  const re = new RegExp(`^${field}:\\s*(.*)$`, "mi");
  const m = md.match(re);
  return m?.[1]?.trim() || null;
}

export function parseNumberFromFilename(filename: string): number | null {
  const m = filename.match(/^(\d{4})-/);
  if (!m) return null;
  return Number(m[1]);
}

function teamIdFromTeamDir(teamDir: string): string {
  const base = path.basename(teamDir);
  if (base.startsWith("workspace-")) return base.slice("workspace-".length);
  return base;
}

async function discoverTeamIds(): Promise<string[]> {
  // Convention: ~/.openclaw/workspace-<teamId>
  const root = path.join(os.homedir(), ".openclaw");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }

  return entries
    .filter((e) => e.startsWith("workspace-"))
    .map((e) => e.slice("workspace-".length))
    .filter((id) => Boolean(id) && id !== "workspace")
    .sort();
}

async function listTicketsForTeam(teamId: string, teamDir: string): Promise<TicketSummary[]> {
  const stages: TicketStage[] = ["backlog", "in-progress", "testing", "done"];
  const all: TicketSummary[] = [];

  for (const stage of stages) {
    let files: string[] = [];
    try {
      files = await fs.readdir(stageDir(stage, teamDir));
    } catch {
      files = [];
    }

    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const number = parseNumberFromFilename(f);
      if (number == null) continue;

      const file = path.join(stageDir(stage, teamDir), f);
      const [md, stat] = await Promise.all([fs.readFile(file, "utf8"), fs.stat(file)]);

      const title = parseTitle(md);
      const owner = parseField(md, "Owner");
      const updatedAt = stat.mtime.toISOString();
      const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);

      all.push({
        teamId,
        number,
        id: f.replace(/\.md$/, ""),
        title,
        owner,
        stage,
        file,
        updatedAt,
        ageHours,
      });
    }
  }

  return all;
}

export async function listTickets(arg?: { teamId?: string } | string): Promise<TicketSummary[]> {
  // Overload #1: listTickets(teamDir)
  if (typeof arg === "string") {
    const teamDir = arg;
    const teamId = teamIdFromTeamDir(teamDir);
    const tickets = await listTicketsForTeam(teamId, teamDir);
    tickets.sort((a, b) => a.number - b.number);
    return tickets;
  }

  // Overload #2: listTickets({teamId?}) (or listTickets())
  const teamIds = arg?.teamId ? [arg.teamId] : await discoverTeamIds();
  const all: TicketSummary[] = [];

  for (const teamId of teamIds) {
    const teamDir = getTeamWorkspaceDir(teamId);
    all.push(...(await listTicketsForTeam(teamId, teamDir)));
  }

  all.sort((a, b) => (a.teamId === b.teamId ? a.number - b.number : a.teamId.localeCompare(b.teamId)));
  return all;
}

export async function getTicketByIdOrNumber(
  ticketIdOrNumber: string,
  arg?: { teamId?: string; teamDir?: string } | string,
): Promise<TicketSummary | null> {
  const normalized = ticketIdOrNumber.trim();

  let tickets: TicketSummary[] = [];
  if (typeof arg === "string") {
    tickets = await listTickets(arg);
  } else if (arg?.teamDir) {
    tickets = await listTickets(arg.teamDir);
  } else if (arg?.teamId) {
    tickets = await listTickets({ teamId: arg.teamId });
  } else {
    // Default: current team workspace dir (usually development-team)
    tickets = await listTickets(getTeamWorkspaceDir());
  }

  const byNumber = normalized.match(/^\d+$/) ? tickets.find((t) => t.number === Number(normalized)) : null;
  const byId = tickets.find((t) => t.id === normalized);

  return byId ?? byNumber ?? null;
}

export async function getTicketMarkdown(
  ticketIdOrNumber: string,
  arg?: { teamId?: string; teamDir?: string } | string,
): Promise<{ teamId: string; id: string; file: string; markdown: string; owner: string | null; stage: TicketStage } | null> {
  const hit = await getTicketByIdOrNumber(ticketIdOrNumber, arg);
  if (!hit) return null;

  return {
    teamId: hit.teamId,
    id: hit.id,
    file: hit.file,
    markdown: await fs.readFile(hit.file, "utf8"),
    owner: hit.owner,
    stage: hit.stage,
  };
}
