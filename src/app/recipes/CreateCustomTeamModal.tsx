"use client";

import { useEffect, useMemo, useState } from "react";
import { CreateModalShell } from "./CreateModalShell";
import { fetchJsonWithStatus } from "@/lib/fetch-json";
import type { AgentListItem } from "@/lib/agents";

type SelectedRole = { agentId: string; roleId: string; displayName: string };

function defaultRoleIdFromAgentId(agentId: string) {
  // Strip any existing team prefix if present; keep it sluggy.
  const id = agentId.split("/").pop() || agentId;
  const last = id.split("-").slice(-1)[0] || id;
  return last.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function CreateCustomTeamModal({
  open,
  teamId,
  setTeamId,
  busy,
  error,
  onClose,
  onConfirm,
  onRolesChange,
}: {
  open: boolean;
  teamId: string;
  setTeamId: (v: string) => void;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onRolesChange: (roles: SelectedRole[]) => void;
}) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, SelectedRole>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchJsonWithStatus<{ agents?: AgentListItem[]; error?: string; message?: string }>(
        "/api/agents",
        { cache: "no-store" },
      );
      if (cancelled) return;
      if (!res.ok) {
        setAgentsError(res.error);
        return;
      }
      const list = Array.isArray(res.data.agents) ? res.data.agents : [];
      setAgents(list);
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  const agentChoices = useMemo(() => {
    return agents
      .slice()
      .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
      .map((a) => ({
        id: String(a.id ?? ""),
        label: a.identityName ? `${a.identityName} (${a.id})` : String(a.id ?? ""),
      }))
      .filter((a) => a.id);
  }, [agents]);

  const roles = useMemo(() => Object.values(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    onRolesChange(roles);
  }, [open, roles, onRolesChange]);

  return (
    <CreateModalShell
      open={open}
      title="Create custom team"
      recipeId={"(new recipe)"}
      recipeName={"Custom Team"}
      error={error || agentsError}
      busy={busy}
      canConfirm={!!teamId.trim() && roles.length > 0}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmLabel="Create team"
    >
      <div className="mt-4">
        <label className="text-sm font-medium text-[color:var(--ck-text-primary)]">Team id</label>
        <input
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="e.g. my-team"
          className="mt-2 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm text-[color:var(--ck-text-primary)] placeholder:text-[color:var(--ck-text-tertiary)]"
          autoFocus
        />
        <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
          This creates a new team recipe under <code>~/.openclaw/workspace/recipes</code> and scaffolds
          <code className="ml-1">~/.openclaw/workspace-&lt;teamId&gt;</code>.
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Select agents</div>
        <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
          MVP: this creates new team roles that mirror the selected agents&apos; names. You can edit the
          resulting team recipe later.
        </div>

        <div className="mt-3 max-h-[220px] overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 p-3">
          {agentChoices.length === 0 ? (
            <div className="text-sm text-[color:var(--ck-text-secondary)]">No installed agents found.</div>
          ) : (
            <div className="space-y-2">
              {agentChoices.map((a) => {
                const checked = !!selected[a.id];
                return (
                  <label key={a.id} className="flex items-start gap-2 text-sm text-[color:var(--ck-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = { ...selected };
                        if (e.target.checked) {
                          next[a.id] = {
                            agentId: a.id,
                            roleId: defaultRoleIdFromAgentId(a.id),
                            displayName: a.label,
                          };
                        } else {
                          delete next[a.id];
                        }
                        setSelected(next);
                      }}
                    />
                    <span className="min-w-0 break-words">{a.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {roles.length ? (
        <div className="mt-6">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Role mapping</div>
          <div className="mt-3 space-y-3">
            {roles.map((r) => (
              <div key={r.agentId} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[color:var(--ck-text-tertiary)]">{r.agentId}</div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Role id</label>
                    <input
                      value={r.roleId}
                      onChange={(e) => {
                        setSelected((prev) => ({
                          ...prev,
                          [r.agentId]: { ...prev[r.agentId], roleId: e.target.value },
                        }));
                      }}
                      className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Display name</label>
                    <input
                      value={r.displayName}
                      onChange={(e) => {
                        setSelected((prev) => ({
                          ...prev,
                          [r.agentId]: { ...prev[r.agentId], displayName: e.target.value },
                        }));
                      }}
                      className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </CreateModalShell>
  );
}
