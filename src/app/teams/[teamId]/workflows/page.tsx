import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { getTeamDisplayName } from "@/lib/recipes";
import WorkflowsClient from "./workflows-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

        <div className="flex items-center gap-2">
          <Link
            href={`/teams/${encodeURIComponent(teamId)}/runs`}
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
          >
            View runs
          </Link>
        </div>
      </div>

      <WorkflowsClient teamId={teamId} />
    </div>
  );
}
