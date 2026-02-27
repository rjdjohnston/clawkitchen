import { NextResponse } from "next/server";
import { deleteGoal, goalErrorResponse, readGoal, writeGoal } from "@/lib/goals";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const goal = await readGoal(id);
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ goal: goal.frontmatter, body: goal.body, raw: goal.raw });
  } catch (e: unknown) {
    return goalErrorResponse(e);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    return goalErrorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await deleteGoal(id);
    if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return goalErrorResponse(e);
  }
}
