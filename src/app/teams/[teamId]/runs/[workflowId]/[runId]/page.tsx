import RunDetailClient from "./run-detail-client";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; workflowId: string; runId: string }>;
}) {
  const { teamId, workflowId, runId } = await params;

  return (
    <div className="p-6">
      <div className="ck-glass p-6">
        <RunDetailClient teamId={teamId} workflowId={workflowId} runId={runId} />
      </div>
    </div>
  );
}
