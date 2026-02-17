import { NextResponse } from "next/server";
import { deleteGoal, readGoal, writeGoal } from "@/lib/goals";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const goal = await readGoal(id);
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ goal: goal.frontmatter, body: goal.body, raw: goal.raw });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Invalid goal id|Path traversal/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  type GoalPutBody = {
    title: string;
    status?: "planned" | "active" | "done";
    tags?: string[];
    teams?: string[];
    body?: string;
  };

  try {
    const data = (await req.json()) as GoalPutBody;
    const title = String(data?.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const result = await writeGoal({
      id,
      title,
      status: data?.status,
      tags: Array.isArray(data?.tags) ? data.tags : [],
      teams: Array.isArray(data?.teams) ? data.teams : [],
      body: String(data?.body ?? ""),
    });

    return NextResponse.json({ goal: result.frontmatter });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Invalid goal id|Path traversal/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const result = await deleteGoal(id);
    if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Invalid goal id|Path traversal/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
