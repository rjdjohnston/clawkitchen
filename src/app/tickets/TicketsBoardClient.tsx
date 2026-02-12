"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TicketStage, TicketSummary } from "@/lib/tickets";

const STAGES: { key: TicketStage; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in-progress", label: "In progress" },
  { key: "testing", label: "Testing" },
  { key: "done", label: "Done" },
];

function formatAge(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function TicketsBoardClient({ tickets }: { tickets: TicketSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map: Record<TicketStage, TicketSummary[]> = {
      backlog: [],
      "in-progress": [],
      testing: [],
      done: [],
    };
    for (const t of tickets) map[t.stage].push(t);
    for (const s of Object.keys(map) as TicketStage[]) {
      map[s].sort((a, b) => a.number - b.number);
    }
    return map;
  }, [tickets]);

  async function move(ticket: TicketSummary, to: TicketStage) {
    setError(null);
    const res = await fetch("/api/tickets/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: ticket.id, to }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Move failed (${res.status})`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <div className="text-sm text-[color:var(--ck-text-secondary)]">
          {isPending ? "Updating…" : ""}
        </div>
      </div>

      {error ? (
        <div className="ck-glass border border-[color:var(--ck-border-strong)] p-3 text-sm text-[color:var(--ck-text-primary)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        {STAGES.map(({ key, label }) => (
          <section key={key} className="ck-glass p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
              <span className="text-xs text-[color:var(--ck-text-tertiary)]">
                {byStage[key].length}
              </span>
            </div>

            <div className="space-y-2">
              {byStage[key].length === 0 ? (
                <div className="rounded-[var(--ck-radius-sm)] border border-dashed border-[color:var(--ck-border-subtle)] p-3 text-xs text-[color:var(--ck-text-tertiary)]">
                  Empty
                </div>
              ) : null}

              {byStage[key].map((t) => (
                <div
                  key={t.id}
                  className="rounded-[var(--ck-radius-sm)] border border-[color:var(--ck-border-subtle)] bg-[color:var(--ck-bg-glass-strong)] p-3"
                >
                  <a
                    href={`/tickets/${encodeURIComponent(t.id)}`}
                    className="block text-sm font-medium text-[color:var(--ck-text-primary)] hover:underline"
                  >
                    {String(t.number).padStart(4, "0")} — {t.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--ck-text-secondary)]">
                    <span>{t.owner ? `Owner: ${t.owner}` : "Owner: —"}</span>
                    <span>·</span>
                    <span>Age: {formatAge(t.ageHours)}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="text-xs text-[color:var(--ck-text-tertiary)]">
                      Move
                      <select
                        className="ml-2 rounded border border-[color:var(--ck-border-subtle)] bg-transparent px-2 py-1 text-xs"
                        defaultValue={t.stage}
                        onChange={(e) => {
                          const to = e.target.value as TicketStage;
                          startTransition(() => {
                            move(t, to)
                              .then(() => router.refresh())
                              .catch((err) => setError(err.message));
                          });
                        }}
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-[color:var(--ck-text-tertiary)]">
        Source of truth: development-team markdown tickets (via openclaw recipes move-ticket).
      </p>
    </div>
  );
}
