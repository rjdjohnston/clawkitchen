import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { listRecipes } from "@/lib/recipes";
import WorkflowsClient from "./workflows-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getTeamDisplayName(teamId: string) {
  const recipes = await listRecipes();
  const match = recipes.find((r) => r.kind === "team" && r.id === teamId);
  return match?.name ?? null;
}

export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  noStore();

  const { teamId } = await params;
  const name = await getTeamDisplayName(teamId);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/teams/${encodeURIComponent(teamId)}`}
            className="text-sm font-medium text-[color:var(--ck-text-secondary)] hover:underline"
          >
            ← {name || teamId}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-[color:var(--ck-text-secondary)]">
            Create and edit workflow definitions for this team.
          </p>
        </div>
      </div>

      <WorkflowsClient teamId={teamId} />
    </div>
  );
}
