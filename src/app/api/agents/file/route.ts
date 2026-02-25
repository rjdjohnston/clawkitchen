import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/errors";
import { assertSafeRelativeFileName } from "@/lib/paths";
import { getAgentContextFromBody, getAgentContextFromQuery } from "@/lib/api-route-helpers";

export async function GET(req: Request) {
  const ctx = await getAgentContextFromQuery(req);
  if (ctx instanceof NextResponse) return ctx;
  const { agentId, ws } = ctx;

  const { searchParams } = new URL(req.url);
  const name = String(searchParams.get("name") ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const safe = assertSafeRelativeFileName(name);
  const filePath = path.join(ws, safe);

  try {
    const content = await fs.readFile(filePath, "utf8");
    return NextResponse.json({ ok: true, agentId, workspace: ws, name: safe, filePath, content });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 404 });
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { agentId?: string; name?: string; content?: string };
  const name = String(body.name ?? "").trim();
  const content = typeof body.content === "string" ? body.content : null;
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  if (content === null) return NextResponse.json({ ok: false, error: "content is required" }, { status: 400 });

  const ctx = await getAgentContextFromBody(body);
  if (ctx instanceof NextResponse) return ctx;
  const { agentId, ws } = ctx;

  const safe = assertSafeRelativeFileName(name);
  const filePath = path.join(ws, safe);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return NextResponse.json({ ok: true, agentId, workspace: ws, name: safe, filePath });
}
