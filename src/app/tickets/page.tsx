import { listTickets } from "@/lib/tickets";
import { TicketsBoardClient } from "@/app/tickets/TicketsBoardClient";

export default async function TicketsPage() {
  const tickets = await listTickets();
  return <TicketsBoardClient tickets={tickets} />;
}
