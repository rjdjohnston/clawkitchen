import RunsClient from "./runs-client";

export default async function RunsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  return (
    <div className="p-6">
      <div className="ck-glass p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
            <p className="mt-1 text-sm text-[color:var(--ck-text-secondary)]">
              Recent workflow runs for this team (file-first).
            </p>
          </div>
        </div>

        <div className="mt-6">
          <RunsClient teamId={teamId} />
        </div>
      </div>
    </div>
  );
}
