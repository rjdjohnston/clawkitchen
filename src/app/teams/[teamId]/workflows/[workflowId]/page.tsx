import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import WorkflowsEditorClient from "./workflows-editor-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WorkflowEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; workflowId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();

  const { teamId, workflowId } = await params;
  const sp = (await searchParams) ?? {};
  const draftRaw = sp.draft;
  const draft = Array.isArray(draftRaw) ? draftRaw[0] : draftRaw;

  return (
    <div className="space-y-4 p-6">
      <Link
        href={`/teams/${encodeURIComponent(teamId)}?tab=workflows`}
        className="text-sm font-medium hover:underline"
      >
        ← Back
      </Link>

      <WorkflowsEditorClient teamId={teamId} workflowId={workflowId} draft={draft === "1"} />
    </div>
  );
}
