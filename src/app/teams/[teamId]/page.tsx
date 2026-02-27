import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { runOpenClaw } from "@/lib/openclaw";
import TeamEditor from "./team-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const match = items.find((r) => r.kind === "team" && r.id === teamId);
    return match?.name ?? null;
  } catch {
    return null;
  }
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Team pages depend on live OpenClaw state; never serve cached HTML.
  noStore();

  const { teamId } = await params;
  const sp = (await searchParams) ?? {};
  const tabRaw = sp.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const name = await getTeamDisplayName(teamId);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight text-[color:var(--ck-text-primary)]">
            {name || teamId}
          </div>
          <div className="text-xs text-[color:var(--ck-text-tertiary)]">{teamId}</div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/goals?team=${encodeURIComponent(teamId)}`}
            className="text-sm font-medium text-[color:var(--ck-text-secondary)] hover:underline"
          >
            View goals →
          </Link>
        </div>
      </div>

      <TeamEditor teamId={teamId} initialTab={typeof tab === "string" ? tab : undefined} />
    </div>
  );
}
