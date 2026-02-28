import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getTicketByIdOrNumber, listTickets, stageDir, type TicketStage } from "@/lib/tickets";

function desiredStageForAssignee(assignee: string | null): TicketStage {
  if (!assignee) return "backlog";
  if (assignee === "test" || assignee === "qa") return "testing";
  return "in-progress";
}

function upsertField(md: string, field: string, value: string) {
  const re = new RegExp(`^${field}:\\s*.*$`, "mi");
  if (re.test(md)) return md.replace(re, `${field}: ${value}`);

  // Insert after the first header line, or at top if no header.
  const lines = md.split("\n");
  const headerIdx = lines.findIndex((l) => l.startsWith("# "));
  const insertAt = headerIdx >= 0 ? headerIdx + 1 : 0;
  lines.splice(insertAt, 0, `${field}: ${value}`);
  return lines.join("\n");
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function archiveOtherAssignmentStubs(num: number, keepBasename: string) {
  const assignmentsDir = path.join("/home/control/.openclaw/workspace-development-team", "work/assignments");
  const archiveDir = path.join(assignmentsDir, "archive");
  await ensureDir(archiveDir);

  const prefix = String(num).padStart(4, "0") + "-assigned-";

  let entries: string[] = [];
  try {
    entries = await fs.readdir(assignmentsDir);
  } catch {
    entries = [];
  }

  for (const e of entries) {
    if (!e.startsWith(prefix)) continue;
    if (e === keepBasename) continue;
    if (!e.endsWith(".md")) continue;

    const from = path.join(assignmentsDir, e);
    const to = path.join(archiveDir, e);
    try {
      await fs.rename(from, to);
    } catch {
      // ignore
    }
  }
}

async function writeAssignmentStub({ num, assignee, ticketPath }: { num: number; assignee: string; ticketPath: string }) {
  const assignmentsDir = path.join("/home/control/.openclaw/workspace-development-team", "work/assignments");
  await ensureDir(assignmentsDir);

  const bn = `${String(num).padStart(4, "0")}-assigned-${assignee}.md`;
  const p = path.join(assignmentsDir, bn);

  const content = `# ${String(num).padStart(4, "0")} — assigned to ${assignee}\n\n## Ticket\n${ticketPath}\n\n## Notes\n- Assigned via ClawKitchen UI.\n`;
  await fs.writeFile(p, content, "utf8");

  await archiveOtherAssignmentStubs(num, bn);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | {
    ticket: string;
    assignee: string;
  };

  if (!body?.ticket || !body?.assignee) {
    return NextResponse.json({ error: "Missing ticket or assignee" }, { status: 400 });
  }

  const ticket = await getTicketByIdOrNumber(body.ticket);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const assignee = body.assignee.trim();
  const nextStage = desiredStageForAssignee(assignee);

  const currentMd = await fs.readFile(ticket.file, "utf8");
  let updatedMd = upsertField(currentMd, "Owner", assignee);
  // Keep Status in sync with lane.
  updatedMd = upsertField(updatedMd, "Status", nextStage);

  const filename = path.basename(ticket.file);
  const nextPath = path.join(stageDir(nextStage), filename);

  await ensureDir(stageDir(nextStage));

  if (ticket.file !== nextPath) {
    await fs.rename(ticket.file, nextPath);
  }

  await fs.writeFile(nextPath, updatedMd, "utf8");

  await writeAssignmentStub({ num: ticket.number, assignee, ticketPath: path.relative("/home/control/.openclaw/workspace-development-team", nextPath) });

  const refreshed = (await listTickets()).find((t) => t.number === ticket.number);
  return NextResponse.json({ ok: true, ticket: refreshed ?? null });
}
