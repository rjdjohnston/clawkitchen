import { NextResponse } from "next/server";
import { loadRegistry, search } from "@/lib/marketplace";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const registry = await loadRegistry();
    const recipes = search(registry.recipes, q);

    return NextResponse.json({
      ok: true,
      version: registry.version,
      generatedAt: registry.generatedAt,
      count: recipes.length,
      recipes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
