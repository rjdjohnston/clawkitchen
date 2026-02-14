import Link from "next/link";
import { redirect } from "next/navigation";
import { runOpenClaw } from "@/lib/openclaw";
import RecipeEditor from "./RecipeEditor";

type RecipeListItem = {
  id: string;
  name: string;
  kind: "agent" | "team";
  source: "builtin" | "workspace";
};

async function getKind(id: string): Promise<"agent" | "team" | null> {
  const res = await runOpenClaw(["recipes", "list"]);
  if (!res.ok) return null;
  try {
    const items = JSON.parse(res.stdout) as RecipeListItem[];
    return items.find((r) => r.id === id)?.kind ?? null;
  } catch {
    return null;
  }
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = await getKind(id);

  // Team recipes should use the Team editor UI.
  if (kind === "team") {
    redirect(`/teams/${encodeURIComponent(id)}-team`);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto mb-4 max-w-6xl">
        <Link
          href="/recipes"
          className="text-sm font-medium text-[color:var(--ck-text-secondary)] transition-colors hover:text-[color:var(--ck-text-primary)]"
        >
          ← Back to recipes
        </Link>
      </div>
      <RecipeEditor recipeId={id} />
    </main>
  );
}
