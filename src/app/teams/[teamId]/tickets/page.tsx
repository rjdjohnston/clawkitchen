import { listTickets } from "@/lib/tickets";
import { TicketsBoardClient } from "@/app/tickets/TicketsBoardClient";

export const dynamic = "force-dynamic";

export default async function TeamTicketsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const tickets = await listTickets(teamId);
  return <TicketsBoardClient tickets={tickets} basePath={`/teams/${encodeURIComponent(teamId)}/tickets`} />;
}
