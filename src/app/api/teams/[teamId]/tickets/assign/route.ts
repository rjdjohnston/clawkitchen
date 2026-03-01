import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getTicketByIdOrNumber, listTickets, stageDir, type TicketStage } from "@/lib/tickets";
import { getWorkspaceDir, teamDirFromBaseWorkspace } from "@/lib/paths";

export const dynamic = "force-dynamic";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;

  const body = (await req.json().catch(() => null)) as null | {
    ticket: string;
    assignee: string;
  };

  if (!body?.ticket || !body?.assignee) {
    return NextResponse.json({ error: "Missing ticket or assignee" }, { status: 400 });
  }

  const baseWorkspace = await getWorkspaceDir();
  const teamDir = teamDirFromBaseWorkspace(baseWorkspace, teamId);

  const ticket = await getTicketByIdOrNumber(body.ticket, teamDir);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const assignee = body.assignee.trim();
  const nextStage = desiredStageForAssignee(assignee);

  const currentMd = await fs.readFile(ticket.file, "utf8");
  let updatedMd = upsertField(currentMd, "Owner", assignee);
  updatedMd = upsertField(updatedMd, "Status", nextStage);

  const filename = path.basename(ticket.file);
  const nextPath = path.join(stageDir(nextStage, teamDir), filename);

  await ensureDir(stageDir(nextStage, teamDir));

  if (ticket.file !== nextPath) {
    await fs.rename(ticket.file, nextPath);
  }

  await fs.writeFile(nextPath, updatedMd, "utf8");

  // Assignment stubs are deprecated; do not create/update work/assignments/*.md.

  const refreshed = (await listTickets(teamDir)).find((t) => t.number === ticket.number);
  return NextResponse.json({ ok: true, ticket: refreshed ?? null });
}
