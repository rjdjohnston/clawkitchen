import Link from "next/link";
import { listTickets } from "@/lib/tickets";
import { getWorkspaceDir, teamDirFromBaseWorkspace } from "@/lib/paths";

export const dynamic = "force-dynamic";

export default async function TeamTicketsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const baseWorkspace = await getWorkspaceDir();
  const teamDir = teamDirFromBaseWorkspace(baseWorkspace, teamId);

  const tickets = await listTickets(teamDir);

  return (
    <div className="ck-glass p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Tickets</h1>
        <Link href={`/teams/${encodeURIComponent(teamId)}`} className="text-sm font-medium hover:underline">
          ← Team
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {tickets.length === 0 ? (
          <div className="text-sm text-[color:var(--ck-text-secondary)]">No tickets found.</div>
        ) : (
          tickets.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${encodeURIComponent(teamId)}/tickets/${encodeURIComponent(t.id)}`}
              className="block rounded-md border border-white/10 bg-white/5 p-3 hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">{t.id}</div>
                <div className="text-xs text-[color:var(--ck-text-tertiary)]">{t.stage}</div>
              </div>
              <div className="mt-1 text-sm text-[color:var(--ck-text-secondary)]">{t.title}</div>
              {t.owner ? (
                <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">Owner: {t.owner}</div>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
