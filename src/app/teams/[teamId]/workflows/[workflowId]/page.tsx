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
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-6">
        <Link
          href={`/teams/${encodeURIComponent(teamId)}?tab=workflows`}
          className="text-sm font-medium hover:underline"
        >
          ← Back
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6 pt-4">
        <WorkflowsEditorClient teamId={teamId} workflowId={workflowId} draft={draft === "1"} />
      </div>
    </div>
  );
}
