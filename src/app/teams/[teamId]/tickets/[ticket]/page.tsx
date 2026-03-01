import Link from "next/link";
import { getTicketMarkdown } from "@/lib/tickets";
import { getWorkspaceDir, teamDirFromBaseWorkspace } from "@/lib/paths";
import { TicketAssignControl } from "@/app/tickets/[ticket]/TicketAssignControl";

export const dynamic = "force-dynamic";

export default async function TeamTicketDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; ticket: string }>;
}) {
  const { teamId, ticket } = await params;
  const baseWorkspace = await getWorkspaceDir();
  const teamDir = teamDirFromBaseWorkspace(baseWorkspace, teamId);

  const data = await getTicketMarkdown(ticket, teamDir);

  if (!data) {
    return (
      <div className="ck-glass p-6">
        <h1 className="text-xl font-semibold tracking-tight">Ticket not found</h1>
        <p className="mt-3 text-sm text-[color:var(--ck-text-secondary)]">
          Couldn’t locate “{ticket}” in backlog/in-progress/testing/done for team “{teamId}”.
        </p>
        <div className="mt-4">
          <Link href={`/teams/${encodeURIComponent(teamId)}/tickets`} className="text-sm font-medium hover:underline">
            ← Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/teams/${encodeURIComponent(teamId)}/tickets`} className="text-sm font-medium hover:underline">
          ← Back
        </Link>
        <span className="text-xs text-[color:var(--ck-text-tertiary)]">{data.file}</span>
      </div>

      <TicketAssignControl teamId={teamId} ticket={ticket} currentOwner={data.owner} />

      <div className="ck-glass p-6">
        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--ck-text-primary)]">
          {data.markdown}
        </pre>
      </div>
    </div>
  );
}
