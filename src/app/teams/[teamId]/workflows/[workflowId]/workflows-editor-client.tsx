"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowFileV1 } from "@/lib/workflows/types";
import { validateWorkflowFileV1 } from "@/lib/workflows/validate";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "ready"; jsonText: string };

function draftKey(teamId: string, workflowId: string) {
  return `ck-wf-draft:${teamId}:${workflowId}`;
}

export default function WorkflowsEditorClient({
  teamId,
  workflowId,
  draft,
}: {
  teamId: string;
  workflowId: string;
  draft: boolean;
}) {
  const [view, setView] = useState<"canvas" | "json">("canvas");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<LoadState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string>("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Canvas (minimal): click node selects; drag nodes.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [dragging, setDragging] = useState<null | { nodeId: string; dx: number; dy: number; left: number; top: number }>(null);

  useEffect(() => {
    (async () => {
      try {
        if (draft) {
          const stored = sessionStorage.getItem(draftKey(teamId, workflowId));
          if (stored) {
            setStatus({ kind: "ready", jsonText: stored });
            return;
          }
        }

        const res = await fetch(
          `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}&id=${encodeURIComponent(workflowId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as { ok?: boolean; error?: string; workflow?: unknown };
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load workflow");
        setStatus({ kind: "ready", jsonText: JSON.stringify(json.workflow, null, 2) + "\n" });
      } catch (e: unknown) {
        setStatus({ kind: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, [teamId, workflowId, draft]);

  const parsed = useMemo(() => {
    if (status.kind !== "ready") return { wf: null as WorkflowFileV1 | null, err: "" };
    try {
      const wf = JSON.parse(status.jsonText) as WorkflowFileV1;
      return { wf, err: "" };
    } catch (e: unknown) {
      return { wf: null, err: e instanceof Error ? e.message : String(e) };
    }
  }, [status]);

  const validation = useMemo(() => {
    if (!parsed.wf) return { errors: [], warnings: [] as string[] };
    return validateWorkflowFileV1(parsed.wf);
  }, [parsed.wf]);

  function setWorkflow(next: WorkflowFileV1) {
    const text = JSON.stringify(next, null, 2) + "\n";
    setStatus({ kind: "ready", jsonText: text });
    if (draft) {
      try {
        sessionStorage.setItem(draftKey(teamId, workflowId), text);
      } catch {
        // ignore
      }
    }
  }

  async function onSave() {
    if (status.kind !== "ready") return;
    if (!parsed.wf) return;
    if (parsed.err) return;
    if (validation.errors.length) return;

    setSaving(true);
    setActionError("");
    try {
      const res = await fetch("/api/teams/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, workflow: parsed.wf }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save workflow");

      // Clear draft cache once persisted.
      try {
        sessionStorage.removeItem(draftKey(teamId, workflowId));
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function onExport() {
    if (!parsed.wf) return;
    if (parsed.err) return;
    if (validation.errors.length) return;

    const filename = `${parsed.wf.id || workflowId}.workflow.json`;
    const blob = new Blob([JSON.stringify(parsed.wf, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (status.kind === "loading") return <div className="ck-glass w-full p-6">Loading…</div>;
  if (status.kind === "error") return <div className="ck-glass w-full p-6">{status.error}</div>;

  return (
    <div className="ck-glass flex h-full min-h-0 w-full flex-col p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[color:var(--ck-text-primary)]">
            Workflow editor — {workflowId}.workflow.json
          </div>
          <div className="mt-0.5 text-xs text-[color:var(--ck-text-tertiary)]">Team: {teamId}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-[var(--ck-radius-sm)] border border-white/10">
            <button
              type="button"
              onClick={() => setView("canvas")}
              className={
                view === "canvas"
                  ? "bg-white/10 px-3 py-2 text-xs font-medium text-[color:var(--ck-text-primary)]"
                  : "bg-transparent px-3 py-2 text-xs font-medium text-[color:var(--ck-text-secondary)] hover:bg-white/5"
              }
            >
              Canvas
            </button>
            <button
              type="button"
              onClick={() => setView("json")}
              className={
                view === "json"
                  ? "bg-white/10 px-3 py-2 text-xs font-medium text-[color:var(--ck-text-primary)]"
                  : "bg-transparent px-3 py-2 text-xs font-medium text-[color:var(--ck-text-secondary)] hover:bg-white/5"
              }
            >
              JSON
            </button>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              // Reset the input so re-importing the same file still triggers onChange.
              e.target.value = "";
              if (!file) return;

              setActionError("");
              try {
                const text = await file.text();
                const next = JSON.parse(text) as WorkflowFileV1;
                setStatus({ kind: "ready", jsonText: JSON.stringify(next, null, 2) + "\n" });
                if (draft) {
                  try {
                    sessionStorage.setItem(draftKey(teamId, workflowId), JSON.stringify(next, null, 2) + "\n");
                  } catch {
                    // ignore
                  }
                }
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : String(err));
              }
            }}
          />

          <button
            type="button"
            disabled={saving}
            onClick={() => importInputRef.current?.click()}
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10 disabled:opacity-50"
          >
            Import
          </button>

          <button
            type="button"
            disabled={!parsed.wf || Boolean(parsed.err) || validation.errors.length > 0}
            onClick={onExport}
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10 disabled:opacity-50"
          >
            Export
          </button>

          <button
            type="button"
            disabled={saving || !parsed.wf || Boolean(parsed.err) || validation.errors.length > 0}
            onClick={onSave}
            className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <a
            href={`/teams/${encodeURIComponent(teamId)}?tab=workflows`}
            className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
          >
            Workflows
          </a>
        </div>
      </div>

      {parsed.err ? (
        <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          JSON parse error: {parsed.err}
        </div>
      ) : null}
      {!parsed.err && validation.errors.length ? (
        <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          <div className="font-medium">Workflow validation errors</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {validation.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!parsed.err && !validation.errors.length && validation.warnings.length ? (
        <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          <div className="font-medium">Workflow validation warnings</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {validation.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {actionError}
        </div>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 gap-3">
        {view === "json" ? (
          <textarea
            value={status.jsonText}
            onChange={(e) => {
              const t = e.target.value;
              setStatus({ kind: "ready", jsonText: t });
              if (draft) {
                try {
                  sessionStorage.setItem(draftKey(teamId, workflowId), t);
                } catch {
                  // ignore
                }
              }
            }}
            className="h-full min-h-0 w-full flex-1 resize-none rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3 font-mono text-xs text-[color:var(--ck-text-primary)]"
          />
        ) : (
          <div ref={canvasRef} className="relative h-full min-h-0 w-full flex-1 overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20">
            <div className="relative h-[1200px] w-[2200px]">
              <svg className="absolute inset-0" width={2200} height={1200}>
                {(parsed.wf?.edges ?? []).map((e) => {
                  const wf = parsed.wf;
                  if (!wf) return null;
                  const a = wf.nodes.find((n) => n.id === e.from);
                  const b = wf.nodes.find((n) => n.id === e.to);
                  if (!a || !b) return null;
                  const ax = (typeof a.x === "number" ? a.x : 80) + 90;
                  const ay = (typeof a.y === "number" ? a.y : 80) + 24;
                  const bx = (typeof b.x === "number" ? b.x : 80) + 90;
                  const by = (typeof b.y === "number" ? b.y : 80) + 24;
                  return <line key={e.id} x1={ax} y1={ay} x2={bx} y2={by} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />;
                })}
              </svg>

              {(parsed.wf?.nodes ?? []).map((n, idx) => {
                const x = typeof n.x === "number" ? n.x : 80 + idx * 220;
                const y = typeof n.y === "number" ? n.y : 80;
                const selected = selectedNodeId === n.id;
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedNodeId(n.id)}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      const el = canvasRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      setSelectedNodeId(n.id);
                      setDragging({ nodeId: n.id, dx: e.clientX - rect.left - x, dy: e.clientY - rect.top - y, left: rect.left, top: rect.top });
                    }}
                    onPointerUp={() => setDragging(null)}
                    onPointerMove={(e) => {
                      if (!dragging) return;
                      if (dragging.nodeId !== n.id) return;
                      const wf = parsed.wf;
                      if (!wf) return;
                      const el = canvasRef.current;
                      if (!el) return;
                      const nextX = e.clientX - dragging.left - dragging.dx;
                      const nextY = e.clientY - dragging.top - dragging.dy;
                      const nextNodes = wf.nodes.map((node) => (node.id === n.id ? { ...node, x: nextX, y: nextY } : node));
                      const next: WorkflowFileV1 = { ...wf, nodes: nextNodes };
                      setStatus({ kind: "ready", jsonText: JSON.stringify(next, null, 2) + "\n" });
                    }}
                    className={
                      selected
                        ? "absolute cursor-grab rounded-[var(--ck-radius-sm)] border border-white/25 bg-white/10 px-3 py-2 text-xs text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)]"
                        : "absolute cursor-grab rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-xs text-[color:var(--ck-text-secondary)] hover:bg-white/10"
                    }
                    style={{ left: x, top: y, width: 180 }}
                  >
                    <div className="font-medium text-[color:var(--ck-text-primary)]">{n.name || n.id}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">{n.type}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-[360px] shrink-0 overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Workflow</div>

          {parsed.wf ? (
            (() => {
              const wf = parsed.wf;
              const tz = String(wf.timezone ?? "").trim() || "UTC";
              const triggers = wf.triggers ?? [];

              const meta = wf.meta && typeof wf.meta === "object" && !Array.isArray(wf.meta) ? (wf.meta as Record<string, unknown>) : {};
              const approvalProvider = String(meta.approvalProvider ?? "telegram").trim() || "telegram";
              const approvalTarget = String(meta.approvalTarget ?? "").trim();

              const presets = [
                { label: "(no preset)", expr: "" },
                { label: "Mon/Wed/Fri 09:00 local", expr: "0 9 * * 1,3,5" },
                { label: "Daily 08:00 local", expr: "0 8 * * *" },
                { label: "Mon 09:30 local", expr: "30 9 * * 1" },
              ];

              return (
                <div className="mt-2 space-y-4">
                  <label className="block">
                    <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">timezone</div>
                    <input
                      value={tz}
                      onChange={(e) => {
                        const nextTz = String(e.target.value || "").trim() || "UTC";
                        setWorkflow({ ...wf, timezone: nextTz });
                      }}
                      className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                      placeholder="America/New_York"
                    />
                  </label>

                  <div className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2">
                    <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">approval channel (mvp)</div>
                    <div className="mt-2 space-y-2">
                      <label className="block">
                        <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">provider</div>
                        <input
                          value={approvalProvider}
                          onChange={(e) => {
                            const nextProvider = String(e.target.value || "").trim() || "telegram";
                            setWorkflow({ ...wf, meta: { ...meta, approvalProvider: nextProvider } });
                          }}
                          className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                          placeholder="telegram"
                        />
                      </label>

                      <label className="block">
                        <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">target</div>
                        <input
                          value={approvalTarget}
                          onChange={(e) => {
                            const nextTarget = String(e.target.value || "").trim();
                            setWorkflow({ ...wf, meta: { ...meta, approvalTarget: nextTarget } });
                          }}
                          className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                          placeholder="(e.g. Telegram chat id)"
                        />
                        <div className="mt-1 text-[10px] text-[color:var(--ck-text-tertiary)]">
                          If set, runs that reach a human-approval node can send an approval packet via the gateway message tool.
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">triggers</div>
                      <button
                        type="button"
                        onClick={() => {
                          const id = `t${Date.now()}`;
                          setWorkflow({
                            ...wf,
                            triggers: [
                              ...triggers,
                              { kind: "cron", id, name: "New trigger", enabled: true, expr: "0 9 * * 1-5", tz },
                            ],
                          });
                        }}
                        className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                      >
                        + Add
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {triggers.length ? (
                        triggers.map((t, i) => {
                          const kind = (t as { kind?: unknown }).kind;
                          const isCron = kind === "cron";
                          const id = String((t as { id?: unknown }).id ?? "");
                          const name = String((t as { name?: unknown }).name ?? "");
                          const enabled = Boolean((t as { enabled?: unknown }).enabled);
                          const expr = String((t as { expr?: unknown }).expr ?? "");
                          const trigTz = String((t as { tz?: unknown }).tz ?? tz);
                          const cronFields = expr.trim().split(/\s+/).filter(Boolean);
                          const cronLooksValid = !expr.trim() || cronFields.length === 5;

                          return (
                            <div key={`${id}-${i}`} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-[color:var(--ck-text-primary)]">{name || id || `trigger-${i + 1}`}</div>
                                <button
                                  type="button"
                                  onClick={() => setWorkflow({ ...wf, triggers: triggers.filter((_, idx) => idx !== i) })}
                                  className="text-[10px] text-[color:var(--ck-text-tertiary)] hover:text-[color:var(--ck-text-primary)]"
                                >
                                  Remove
                                </button>
                              </div>

                              {!isCron ? (
                                <div className="mt-1 text-xs text-[color:var(--ck-text-secondary)]">Unsupported trigger kind: {String(kind)}</div>
                              ) : null}

                              <div className="mt-2 grid grid-cols-1 gap-2">
                                <label className="flex items-center gap-2 text-xs text-[color:var(--ck-text-secondary)]">
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => {
                                      const nextEnabled = e.target.checked;
                                      setWorkflow({
                                        ...wf,
                                        triggers: triggers.map((x, idx) => (idx === i && x.kind === "cron" ? { ...x, enabled: nextEnabled } : x)),
                                      });
                                    }}
                                  />
                                  Enabled
                                </label>

                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">name</div>
                                  <input
                                    value={name}
                                    onChange={(e) => {
                                      const nextName = e.target.value;
                                      setWorkflow({
                                        ...wf,
                                        triggers: triggers.map((x, idx) => (idx === i && x.kind === "cron" ? { ...x, name: nextName } : x)),
                                      });
                                    }}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                    placeholder="Content cadence"
                                  />
                                </label>

                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">schedule (cron)</div>
                                  <input
                                    value={expr}
                                    onChange={(e) => {
                                      const nextExpr = e.target.value;
                                      setWorkflow({
                                        ...wf,
                                        triggers: triggers.map((x, idx) => (idx === i && x.kind === "cron" ? { ...x, expr: nextExpr } : x)),
                                      });
                                    }}
                                    className={
                                      cronLooksValid
                                        ? "mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 font-mono text-[11px] text-[color:var(--ck-text-primary)]"
                                        : "mt-1 w-full rounded-[var(--ck-radius-sm)] border border-red-400/50 bg-black/25 px-2 py-1 font-mono text-[11px] text-[color:var(--ck-text-primary)]"
                                    }
                                    placeholder="0 9 * * 1,3,5"
                                  />
                                  {!cronLooksValid ? (
                                    <div className="mt-1 text-[10px] text-red-200">
                                      Cron should be 5 fields (min hour dom month dow). You entered {cronFields.length}.
                                    </div>
                                  ) : null}
                                  <div className="mt-1 grid grid-cols-1 gap-1">
                                    <select
                                      value={presets.some((p) => p.expr === expr) ? expr : ""}
                                      onChange={(e) => {
                                        const nextExpr = e.target.value;
                                        if (!nextExpr) return;
                                        setWorkflow({
                                          ...wf,
                                          triggers: triggers.map((x, idx) => (idx === i && x.kind === "cron" ? { ...x, expr: nextExpr } : x)),
                                        });
                                      }}
                                      className="w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-[11px] text-[color:var(--ck-text-secondary)]"
                                    >
                                      {presets.map((p) => (
                                        <option key={p.label} value={p.expr}>
                                          {p.label}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="text-[10px] text-[color:var(--ck-text-tertiary)]">Presets set the cron; edit freely for advanced schedules.</div>
                                  </div>
                                </label>

                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">timezone override</div>
                                  <input
                                    value={trigTz}
                                    onChange={(e) => {
                                      const nextTz = String(e.target.value || "").trim() || tz;
                                      setWorkflow({
                                        ...wf,
                                        triggers: triggers.map((x, idx) => (idx === i && x.kind === "cron" ? { ...x, tz: nextTz } : x)),
                                      });
                                    }}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                    placeholder={tz}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-[color:var(--ck-text-secondary)]">No triggers yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Selection</div>
                    {selectedNodeId ? (
                      <div className="mt-2 text-xs text-[color:var(--ck-text-primary)]">Node: {selectedNodeId}</div>
                    ) : (
                      <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">Click a node to inspect.</div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>
      </div>
    </div>
  );
}
