import { listTickets } from "@/lib/tickets";
import { TicketsBoardClient } from "@/app/tickets/TicketsBoardClient";

// Tickets reflect live filesystem state; do not cache.
export const dynamic = "force-dynamic";

export default async function TicketsPage({ searchParams }: { searchParams?: { team?: string } }) {
  const teamId = typeof searchParams?.team === "string" ? searchParams.team : undefined;
  const tickets = await listTickets({ teamId });
  return <TicketsBoardClient tickets={tickets} teamId={teamId ?? null} />;
}
