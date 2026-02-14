import Link from "next/link";
import { runOpenClaw } from "@/lib/openclaw";
import TeamEditor from "./team-editor";

type RecipeListItem = {
  id: string;
  name: string;
  kind: "agent" | "team";
  source: "builtin" | "workspace";
};

async function getTeamDisplayName(teamId: string) {
  const res = await runOpenClaw(["recipes", "list"]);
  if (!res.ok) return null;
  try {
    const items = JSON.parse(res.stdout) as RecipeListItem[];
    const normalized = teamId.endsWith("-team") ? teamId.slice(0, -"-team".length) : teamId;
    const match = items.find((r) => r.kind === "team" && (r.id === teamId || r.id === normalized));
    return match?.name ?? null;
  } catch {
    return null;
  }
}

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const name = await getTeamDisplayName(teamId);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm font-medium text-[color:var(--ck-text-secondary)] transition-colors hover:text-[color:var(--ck-text-primary)]"
        >
          ← Home
        </Link>
        <div className="text-right">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">{name || teamId}</div>
          <div className="text-xs text-[color:var(--ck-text-tertiary)]">{teamId}</div>
        </div>
      </div>

      <TeamEditor teamId={teamId} />
    </main>
  );
}
