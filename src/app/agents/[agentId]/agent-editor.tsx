"use client";

import { useEffect, useState } from "react";

type AgentListItem = {
  id: string;
  identityName?: string;
  workspace?: string;
  model?: string;
  isDefault?: boolean;
};

export default function AgentEditor({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [emoji, setEmoji] = useState<string>("");
  const [theme, setTheme] = useState<string>("");
  const [avatar, setAvatar] = useState<string>("");

  const [saveAsNewId, setSaveAsNewId] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage("");
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        const json = await res.json();
        const list = (json.agents ?? []) as AgentListItem[];
        const found = list.find((a) => a.id === agentId) ?? null;
        setAgent(found);
        setName(found?.identityName ?? "");
      } catch (e: unknown) {
        setMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [agentId]);

  async function onSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/agents/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, name, emoji, theme, avatar }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Save failed");
      setMessage("Saved identity via openclaw agents set-identity");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAsNew() {
    const newAgentId = saveAsNewId.trim();
    if (!newAgentId) return setMessage("New agent id is required");

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/agents/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newAgentId, name, emoji, theme, avatar, model: agent.model }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Save As New failed");
      setMessage(`Created new agent: ${newAgentId}`);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="ck-glass mx-auto max-w-4xl p-6">Loading…</div>;
  if (!agent) return <div className="ck-glass mx-auto max-w-4xl p-6">Agent not found: {agentId}</div>;

  return (
    <div className="ck-glass mx-auto max-w-4xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Agent editor</h1>
      <div className="mt-1 text-xs text-[color:var(--ck-text-secondary)]">
        {agent.id}
        {agent.isDefault ? " • default" : ""}
        {agent.model ? ` • ${agent.model}` : ""}
      </div>
      {agent.workspace ? (
        <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">Workspace: {agent.workspace}</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4">
        <div className="ck-glass-strong p-4">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Identity</div>

          <label className="mt-3 block text-xs font-medium text-[color:var(--ck-text-secondary)]">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[color:var(--ck-text-secondary)]">Emoji</label>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🦞"
                className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--ck-text-secondary)]">Theme</label>
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="warm, sharp, calm"
                className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--ck-text-secondary)]">Avatar</label>
              <input
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="avatars/openclaw.png"
                className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
              />
            </div>
          </div>

          <label className="mt-4 block text-xs font-medium text-[color:var(--ck-text-secondary)]">
            Save As New (new agent id)
          </label>
          <input
            value={saveAsNewId}
            onChange={(e) => setSaveAsNewId(e.target.value)}
            placeholder={`${agentId}-copy`}
            className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
          />

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              disabled={saving}
              onClick={onSave}
              className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] transition-colors hover:bg-[var(--ck-accent-red-hover)] active:bg-[var(--ck-accent-red-active)] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>

            <button
              disabled={saving}
              onClick={onSaveAsNew}
              className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save As New"}
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3 text-sm text-[color:var(--ck-text-primary)]">
            {message}
          </div>
        ) : null}

        <div className="ck-glass-strong p-4">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Next sub-areas (not yet)</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[color:var(--ck-text-secondary)]">
            <li>Skills management</li>
            <li>Agent config fields beyond identity</li>
            <li>Edit agent-created files</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
