import Link from "next/link";
import { getTicketMarkdown } from "@/lib/tickets";

// Ticket detail should always reflect current stage/file; do not cache.
export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticket: string }>;
}) {
  const { ticket } = await params;
  const data = await getTicketMarkdown(ticket);

  if (!data) {
    return (
      <div className="ck-glass p-6">
        <h1 className="text-xl font-semibold tracking-tight">Ticket not found</h1>
        <p className="mt-3 text-sm text-[color:var(--ck-text-secondary)]">
          Couldn’t locate “{ticket}” in backlog/in-progress/testing/done.
        </p>
        <div className="mt-4">
          <Link href="/tickets" className="text-sm font-medium hover:underline">
            ← Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/tickets" className="text-sm font-medium hover:underline">
          ← Back
        </Link>
        <span className="text-xs text-[color:var(--ck-text-tertiary)]">{data.file}</span>
      </div>

      <div className="ck-glass p-6">
        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--ck-text-primary)]">
          {data.markdown}
        </pre>
      </div>
    </div>
  );
}
