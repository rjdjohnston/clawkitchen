"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parse as parseYaml } from "yaml";
import { useRouter } from "next/navigation";
import { DeleteTeamModal } from "./DeleteTeamModal";
import { PublishChangesModal } from "./PublishChangesModal";
import { useToast } from "@/components/ToastProvider";
import { OrchestratorPanel } from "./OrchestratorPanel";
import type { WorkflowFileV1 } from "@/lib/workflows/types";
import { validateWorkflowFileV1 } from "@/lib/workflows/validate";

type RecipeListItem = {
  id: string;
  name: string;
  kind: "agent" | "team";
  source: "builtin" | "workspace";
};

type RecipeDetail = RecipeListItem & {
  content: string;
  filePath: string | null;
};


function forceFrontmatterId(md: string, id: string) {
  if (!md.startsWith("---\n")) return md;
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return md;
  const fm = md.slice(4, end);
  const body = md.slice(end + 5);

  const lines = fm.split("\n");
  let found = false;
  const nextLines = lines.map((line) => {
    if (/^id\s*:/i.test(line)) {
      found = true;
      return `id: ${id}`;
    }
    return line;
  });
  if (!found) nextLines.unshift(`id: ${id}`);

  return `---\n${nextLines.join("\n")}\n---\n${body}`;
}

function forceFrontmatterTeamTeamId(md: string, teamId: string) {
  // Best-effort YAML frontmatter patch without reparsing the whole recipe.
  // Goal: ensure `team: { teamId: <id> }` matches the custom recipe id after Save.
  if (!md.startsWith("---\n")) return md;
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return md;

  const fm = md.slice(4, end);
  const body = md.slice(end + 5);
  const lines = fm.split("\n");

  const next: string[] = [];
  let inTeam = false;
  let sawTeamBlock = false;
  let patched = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^team\s*:\s*$/i.test(line)) {
      inTeam = true;
      sawTeamBlock = true;
      next.push(line);
      continue;
    }

    // Leave team block when indentation returns to column 0.
    if (inTeam && /^\S/.test(line)) {
      inTeam = false;
    }

    if (inTeam && /^\s+teamId\s*:/i.test(line)) {
      next.push(`  teamId: ${teamId}`);
      patched = true;
      continue;
    }

    next.push(line);
  }

  // If there was a team block but no teamId, insert it right after `team:`.
  if (sawTeamBlock && !patched) {
    const out: string[] = [];
    for (let i = 0; i < next.length; i++) {
      out.push(next[i]);
      if (/^team\s*:\s*$/i.test(next[i])) {
        out.push(`  teamId: ${teamId}`);
        patched = true;
      }
    }
    return `---\n${out.join("\n")}\n---\n${body}`;
  }

  return `---\n${next.join("\n")}\n---\n${body}`;
}

export default function TeamEditor({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [fromId, setFromId] = useState<string>("");
  const [lockedFromId, setLockedFromId] = useState<string | null>(null);
  const [lockedFromName, setLockedFromName] = useState<string | null>(null);
  const [provenanceMissing, setProvenanceMissing] = useState(false);
  const [toId, setToId] = useState<string>(teamId);
  const [toName, setToName] = useState<string>(teamId);
  const [content, setContent] = useState<string>("");
  const [loadedRecipeHash, setLoadedRecipeHash] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"recipe" | "agents" | "skills" | "cron" | "workflows" | "files" | "orchestrator">("recipe");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [recipeLoadError, setRecipeLoadError] = useState<string>("");
  const toast = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const [teamMetaRecipeHash, setTeamMetaRecipeHash] = useState<string | null>(null);

  function flashMessage(next: string, kind: "success" | "error" | "info" = "info") {
    const msg = String(next ?? "").trim();
    if (!msg) return;
    toast.push({ kind, message: msg });
  }

  const [teamFiles, setTeamFiles] = useState<Array<{ name: string; missing: boolean; required: boolean; rationale?: string }>>([]);
  const [teamFilesLoading, setTeamFilesLoading] = useState(false);
  const [teamFileError, setTeamFileError] = useState<string>("");
  const [showOptionalFiles, setShowOptionalFiles] = useState(false);
  const [fileName, setFileName] = useState<string>("SOUL.md");
  const [fileContent, setFileContent] = useState<string>("");

  const [cronJobs, setCronJobs] = useState<unknown[]>([]);
  const [cronLoading, setCronLoading] = useState(false);

  const [workflowFiles, setWorkflowFiles] = useState<string[]>([]);
  const [workflowFilesLoading, setWorkflowFilesLoading] = useState(false);
  const [workflowFilesError, setWorkflowFilesError] = useState<string>("");
  const [selectedWorkflowFile, setSelectedWorkflowFile] = useState<string>("");
  const [workflowJsonText, setWorkflowJsonText] = useState<string>("");
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowView, setWorkflowView] = useState<"canvas" | "json">("canvas");
  const [workflowSelectedNodeId, setWorkflowSelectedNodeId] = useState<string>("");
  const [workflowDragging, setWorkflowDragging] = useState<null | { nodeId: string; dx: number; dy: number; containerLeft: number; containerTop: number }>(null);

  // Canvas editor helpers (minimal MVP): add/remove nodes + edges via inspector forms.
  const [workflowNewNodeId, setWorkflowNewNodeId] = useState<string>("");
  const [workflowNewNodeName, setWorkflowNewNodeName] = useState<string>("");
  const [workflowNewNodeType, setWorkflowNewNodeType] = useState<WorkflowFileV1["nodes"][number]["type"]>("llm");
  const [workflowNewEdgeFrom, setWorkflowNewEdgeFrom] = useState<string>("");
  const [workflowNewEdgeTo, setWorkflowNewEdgeTo] = useState<string>("");
  const [workflowNewEdgeLabel, setWorkflowNewEdgeLabel] = useState<string>("");

  const [workflowEditorOpen, setWorkflowEditorOpen] = useState(false);

  const [workflowCreateOpen, setWorkflowCreateOpen] = useState(false);
  const [workflowCreateId, setWorkflowCreateId] = useState("new-workflow");
  const [workflowCreateName, setWorkflowCreateName] = useState("New workflow");

  const [workflowRuns, setWorkflowRuns] = useState<string[]>([]);
  const [workflowRunsLoading, setWorkflowRunsLoading] = useState(false);
  const [workflowRunsError, setWorkflowRunsError] = useState<string>("");
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string>("");
  const [selectedWorkflowRun, setSelectedWorkflowRun] = useState<unknown | null>(null);

  const [teamAgents, setTeamAgents] = useState<Array<{ id: string; identityName?: string }>>([]);
  const [teamAgentsLoading, setTeamAgentsLoading] = useState(false);

  const workflowCanvasRef = useRef<HTMLDivElement | null>(null);
  const workflowImportInputRef = useRef<HTMLInputElement | null>(null);

  const workflowParsed = useMemo(() => {
    const raw = String(workflowJsonText || "").trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorkflowFileV1;
    } catch {
      return null;
    }
  }, [workflowJsonText]);

  const workflowParseError = useMemo(() => {
    const raw = String(workflowJsonText || "").trim();
    if (!raw) return "";
    try {
      JSON.parse(raw);
      return "";
    } catch (e: unknown) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [workflowJsonText]);

  const workflowValidation = useMemo(() => {
    if (!workflowParsed) return { errors: [], warnings: [] };
    try {
      return validateWorkflowFileV1(workflowParsed);
    } catch (e: unknown) {
      return { errors: [e instanceof Error ? e.message : String(e)], warnings: [] };
    }
  }, [workflowParsed]);

  useEffect(() => {
    const wfId = String(workflowParsed?.id ?? "").trim();
    if (!wfId) {
      setWorkflowRuns([]);
      setSelectedWorkflowRunId("");
      setSelectedWorkflowRun(null);
      setWorkflowRunsError("");
      return;
    }

    let canceled = false;
    (async () => {
      setWorkflowRunsLoading(true);
      setWorkflowRunsError("");
      try {
        const res = await fetch(
          `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(wfId)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to list runs");
        const files = Array.isArray(json.files) ? json.files : [];
        const list = files.map((f: unknown) => String(f ?? "").trim()).filter((f: string) => Boolean(f));
        if (canceled) return;
        setWorkflowRuns(list);
        if (selectedWorkflowRunId && !list.some((f: string) => f === `${selectedWorkflowRunId}.run.json`)) {
          setSelectedWorkflowRunId("");
          setSelectedWorkflowRun(null);
        }
      } catch (e: unknown) {
        if (canceled) return;
        setWorkflowRunsError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!canceled) setWorkflowRunsLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [teamId, workflowParsed?.id, selectedWorkflowRunId]);

  useEffect(() => {
    if (!workflowDragging) return;

    function onMove(e: PointerEvent) {
      if (!workflowDragging) return;
      const wf = workflowParsed;
      if (!wf) return;

      const node = wf.nodes.find((n) => n.id === workflowDragging.nodeId);
      if (!node) return;

      const x = Math.max(0, Math.round(e.clientX - workflowDragging.containerLeft - workflowDragging.dx));
      const y = Math.max(0, Math.round(e.clientY - workflowDragging.containerTop - workflowDragging.dy));

      const next: WorkflowFileV1 = {
        ...wf,
        nodes: wf.nodes.map((n) => (n.id === node.id ? { ...n, x, y } : n)),
      };
      setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
    }

    function onUp() {
      setWorkflowDragging(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [workflowDragging, workflowParsed]);

  const recipeAgents = useMemo(() => {
    const md = String(content ?? "");
    if (!md.startsWith("---\n")) return [] as Array<{ role: string; name?: string }>;
    const end = md.indexOf("\n---\n", 4);
    if (end === -1) return [] as Array<{ role: string; name?: string }>;
    const fmText = md.slice(4, end + 1);
    try {
      const fm = (parseYaml(fmText) ?? {}) as { agents?: unknown };
      const agents = Array.isArray(fm.agents) ? fm.agents : [];
      return agents
        .map((a) => a as { role?: unknown; name?: unknown })
        .map((a) => ({ role: String(a.role ?? "").trim(), name: typeof a.name === "string" ? a.name : undefined }))
        .filter((a) => Boolean(a.role));
    } catch {
      return [] as Array<{ role: string; name?: string }>;
    }
  }, [content]);

  const [newRole, setNewRole] = useState<string>("");
  const [customRole, setCustomRole] = useState<string>("");
  const [newRoleName, setNewRoleName] = useState<string>("");

  const derivedRole = useMemo(() => {
    const v = (newRole === "__custom__" ? customRole : newRole).trim();
    if (!v) return "";
    return v;
  }, [newRole, customRole]);

  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [installingSkill, setInstallingSkill] = useState(false);
  const [teamSkillMsg, setTeamSkillMsg] = useState<string>("");
  const [teamSkillError, setTeamSkillError] = useState<string>("");

  const teamRecipes = useMemo(() => recipes.filter((r) => r.kind === "team"), [recipes]);

  const toRecipe = useMemo(() => {
    // Prefer the workspace recipe when both builtin + workspace exist for the same id.
    const ws = recipes.find((r) => r.id === toId && r.source === "workspace");
    return ws ?? recipes.find((r) => r.id === toId) ?? null;
  }, [recipes, toId]);

  const teamIdValid = Boolean(teamId.trim());
  const targetIdValid = Boolean(toId.trim());
  const hasWorkspaceOverride = recipes.some((r) => r.id === toId && r.source === "workspace");
  const targetIsBuiltin = Boolean(toRecipe?.source === "builtin" && !hasWorkspaceOverride);
  // The "Recipe id" field is the workspace recipe id target.
  // It should be editable, and we must not auto-prefix/modify what the user types.
  const canEditTargetId = true;

  // Initialize defaults whenever we navigate to a new team.
  useEffect(() => {
    setToId(teamId);
    setToName(teamId);
    setContent("");
    setLoadedRecipeHash(null);
    setTeamMetaRecipeHash(null);
    setPublishOpen(false);
    setDeleteOpen(false);
  }, [teamId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [recipesRes, metaRes] = await Promise.all([
          fetch("/api/recipes", { cache: "no-store" }),
          fetch(`/api/teams/meta?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
        ]);

        const json = await recipesRes.json();
        const list = (json.recipes ?? []) as RecipeListItem[];
        setRecipes(list);

        // Note: do not sync toName/toId from remote state here.
        // Edits to the target id/name must not trigger reload loops while typing.

        // Prefer a recipe that corresponds to this teamId.
        // Primary source of truth: provenance stored in the team workspace.
        // Fallback: heuristic matching (legacy teams without provenance).
        let locked: { recipeId: string; recipeName?: string } | null = null;
        try {
          const metaJson = await metaRes.json();
          if (metaRes.ok && metaJson.ok && metaJson.meta && (metaJson.meta as { recipeId?: unknown }).recipeId) {
            const m = metaJson.meta as { recipeId?: unknown; recipeName?: unknown; recipeHash?: unknown };
            locked = {
              recipeId: String(m.recipeId),
              recipeName: typeof m.recipeName === "string" ? m.recipeName : undefined,
            };
            const h = typeof m.recipeHash === "string" ? m.recipeHash : null;
            setTeamMetaRecipeHash(h);
          } else {
            setTeamMetaRecipeHash(null);
          }
        } catch {
          // ignore
        }

        if (locked) {
          setLockedFromId(locked.recipeId);
          setLockedFromName(locked.recipeName ?? null);
          setProvenanceMissing(false);
          setFromId(locked.recipeId);
        } else {
          setLockedFromId(null);
          setLockedFromName(null);
          setProvenanceMissing(true);

          const preferred = list.find((r) => r.kind === "team" && r.id === teamId);
          const fallback = list.find((r) => r.kind === "team");
          const pick = preferred ?? fallback;
          if (pick) setFromId(pick.id);
        }

        // Render ASAP; load the heavier per-tab data in the background.
        setLoading(false);

        void (async () => {
          setTeamFilesLoading(true);
          setCronLoading(true);
          setWorkflowFilesLoading(true);
          setTeamAgentsLoading(true);
          setSkillsLoading(true);

          try {
            const [filesRes, cronRes, agentsRes, skillsRes, availableSkillsRes, workflowsRes] = await Promise.all([
              fetch(`/api/teams/files?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
              fetch(`/api/cron/jobs?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
              fetch("/api/agents", { cache: "no-store" }),
              fetch(`/api/teams/skills?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
              fetch("/api/skills/available", { cache: "no-store" }),
              fetch(`/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
            ]);

            try {
              const filesJson = (await filesRes.json()) as { ok?: boolean; files?: unknown[] };
              if (filesRes.ok && filesJson.ok) {
                const files = Array.isArray(filesJson.files) ? filesJson.files : [];
                setTeamFiles(
                  files.map((f) => {
                    const entry = f as { name?: unknown; missing?: unknown; required?: unknown; rationale?: unknown };
                    return {
                      name: String(entry.name ?? ""),
                      missing: Boolean(entry.missing),
                      required: Boolean(entry.required),
                      rationale: typeof entry.rationale === "string" ? entry.rationale : undefined,
                    };
                  }),
                );
              }
            } catch {
              // ignore
            }

            try {
              const cronJson = (await cronRes.json()) as { ok?: boolean; jobs?: unknown[] };
              if (cronRes.ok && cronJson.ok) {
                const all = Array.isArray(cronJson.jobs) ? cronJson.jobs : [];
                setCronJobs(all);
              }
            } catch {
              // ignore
            }

            try {
              const workflowsJson = (await workflowsRes.json()) as { ok?: boolean; files?: unknown[]; dir?: unknown };
              if (workflowsRes.ok && workflowsJson.ok) {
                const files = Array.isArray(workflowsJson.files) ? workflowsJson.files : [];
                const list = files.map((f) => String(f ?? '').trim()).filter((f) => Boolean(f));
                setWorkflowFiles(list);
                setSelectedWorkflowFile((prev) => {
                  const p = String(prev ?? '').trim();
                  if (p && list.includes(p)) return p;
                  return list[0] ?? '';
                });
              }
            } catch {
              // ignore
            }

            try {
              const agentsJson = (await agentsRes.json()) as { agents?: unknown[] };
              if (agentsRes.ok) {
                const all = Array.isArray(agentsJson.agents) ? agentsJson.agents : [];
                // Team membership for agents is by id convention: <teamId>-<role>
                const filtered = all.filter((a) => String((a as { id?: unknown }).id ?? "").startsWith(`${teamId}-`));
                setTeamAgents(
                  filtered.map((a) => {
                    const agent = a as { id?: unknown; identityName?: unknown };
                    return { id: String(agent.id ?? ""), identityName: typeof agent.identityName === "string" ? agent.identityName : undefined };
                  }),
                );
              }
            } catch {
              // ignore
            }

            try {
              const skillsJson = await skillsRes.json();
              if (skillsRes.ok && skillsJson.ok) {
                setSkillsList(Array.isArray(skillsJson.skills) ? (skillsJson.skills as string[]) : []);
              }
            } catch {
              // ignore
            }

            try {
              const availableSkillsJson = (await availableSkillsRes.json()) as { ok?: boolean; skills?: unknown[] };
              if (availableSkillsRes.ok && availableSkillsJson.ok) {
                const list = Array.isArray(availableSkillsJson.skills) ? (availableSkillsJson.skills as string[]) : [];
                setAvailableSkills(list);
                setSelectedSkill((prev) => {
                  const p = String(prev ?? "").trim();
                  if (p && list.includes(p)) return p;
                  return list[0] ?? "";
                });
              }
            } catch {
              // ignore
            }
          } finally {
            setTeamFilesLoading(false);
            setCronLoading(false);
            setWorkflowFilesLoading(false);
            setTeamAgentsLoading(false);
            setSkillsLoading(false);
          }
        })();
      } catch (e: unknown) {
        flashMessage(e instanceof Error ? e.message : String(e), "error");
      } finally {
        // If the happy-path already flipped loading=false early, this is a no-op.
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function onLoadTeamRecipeMarkdown() {
    const id = toId.trim();
    if (!id) return;
    setLoadingSource(true);
    setRecipeLoadError("");
    try {
      const res = await fetch(`/api/recipes/${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        // Usually means the workspace recipe doesn't exist yet.
        throw new Error(json.error || `Recipe not found: ${id}. Save first to create it.`);
      }
      const r = json.recipe as RecipeDetail;
      setContent(r.content);
      setLoadedRecipeHash(typeof json.recipeHash === "string" ? json.recipeHash : null);
    } catch (e: unknown) {
      setRecipeLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSource(false);
    }
  }

  // Load raw recipe markdown by default (no "click to load").
  useEffect(() => {
    const id = toId.trim();
    if (!id) return;
    if (content.trim()) return;
    if (loadingSource) return;
    void onLoadTeamRecipeMarkdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toId]);

  async function ensureCustomRecipeExists(args: { overwrite: boolean; toId?: string; toName?: string; scaffold?: boolean }) {
    const f = fromId.trim();
    const id = String(args.toId ?? toId).trim();
    const name = String(args.toName ?? toName).trim();
    const overwrite = Boolean(args.overwrite);
    const scaffold = Boolean(args.scaffold);

    if (!f) throw new Error("Source recipe id is required");
    if (!id) throw new Error("Custom recipe id is required");

    const res = await fetch("/api/recipes/clone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromId: f, toId: id, toName: name || undefined, overwrite, scaffold }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Save failed");
    return json as { filePath: string; content: string; scaffold?: { ok: boolean; error?: string } | null };
  }

  async function onSaveCustom(overwrite: boolean, overrides?: { toId?: string; toName?: string; scaffold?: boolean }) {
    setSaving(true);
    flashMessage("");
    try {
      const json = await ensureCustomRecipeExists({ overwrite, ...overrides });

      if (json.scaffold && !json.scaffold.ok) {
        flashMessage(`Scaffold failed (recipe was still cloned): ${json.scaffold.error || "Unknown error"}`, "error");
      }

      // If the user has edited the markdown, "Save (overwrite)" should persist both
      // the updated name (frontmatter) and the edited markdown.
      const hasEdits = Boolean(content.trim()) && content.trim() !== json.content.trim();

      if (hasEdits) {
        const nextContent = forceFrontmatterTeamTeamId(forceFrontmatterId(content, toId.trim()), toId.trim());
        const res = await fetch(`/api/recipes/${encodeURIComponent(toId.trim())}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: nextContent }),
        });
        const putJson = await res.json();
        if (!res.ok) throw new Error(putJson.error || "Save failed");
        setContent(nextContent);
      } else {
        setContent(json.content);
      }

      // Refresh hash from server so Publish can reliably detect unpropagated changes.
      try {
        const res = await fetch(`/api/recipes/${encodeURIComponent(toId.trim())}`, { cache: "no-store" });
        const next = await res.json();
        if (res.ok && typeof next.recipeHash === "string") setLoadedRecipeHash(next.recipeHash);
      } catch {
        setLoadedRecipeHash(null);
      }

      flashMessage(`Saved team recipe: ${json.filePath}`, "success");
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      flashMessage(raw, "error");
    } finally {
      setSaving(false);
    }
  }

  async function onLoadTeamFile(name: string) {
    setSaving(true);
    setTeamFileError("");
    try {
      const res = await fetch(
        `/api/teams/file?teamId=${encodeURIComponent(teamId)}&name=${encodeURIComponent(name)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load file");
      setFileName(name);
      setFileContent(String(json.content ?? ""));
    } catch (e: unknown) {
      setTeamFileError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveTeamFile() {
    setSaving(true);
    setTeamFileError("");
    try {
      const res = await fetch("/api/teams/file", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, name: fileName, content: fileContent }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save file");
      // No toast; keep file-related messaging local.
    } catch (e: unknown) {
      setTeamFileError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // Initial load only gates the minimal state (recipes + team meta). Everything else streams in.
  if (loading) return <div className="ck-glass mx-auto max-w-4xl p-6">Loading…</div>;

  return (
    <div className="ck-glass mx-auto max-w-6xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Team editor</h1>
      <p className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">
        Bootstrap a <strong>custom team recipe</strong> for this installed team, without modifying builtin recipes.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { id: "recipe", label: "Recipe" },
            { id: "agents", label: "Agents" },
            { id: "skills", label: "Skills" },
            { id: "cron", label: "Cron" },
            { id: "workflows", label: "Workflows" },
            { id: "files", label: "Files" },
            { id: "orchestrator", label: "Orchestrator" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={
              activeTab === t.id
                ? "rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)]"
                : "rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "recipe" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="ck-glass-strong p-4">
            <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Custom recipe target</div>
            <label className="mt-3 block text-xs font-medium text-[color:var(--ck-text-secondary)]">Team id</label>
            <input
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              disabled={!canEditTargetId}
              className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)] disabled:opacity-70"
            />
            <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">
              This is the <b>custom recipe id</b> that will be created/overwritten when you save.
            </div>

            <label className="mt-3 block text-xs font-medium text-[color:var(--ck-text-secondary)]">Team name</label>
            <input
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
            />

            <div className="mt-4 grid grid-cols-1 gap-2">
              {/* Load team markdown removed (auto-loads by default). */}

              <button
                type="button"
                disabled={saving || !teamIdValid || !targetIdValid || targetIsBuiltin}
                onClick={() => onSaveCustom(true)}
                className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] transition-colors hover:bg-[var(--ck-accent-red-hover)] active:bg-[var(--ck-accent-red-active)] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  !teamIdValid ||
                  !targetIdValid ||
                  targetIsBuiltin ||
                  // Enabled only when there are unpropagated (saved) changes.
                  !loadedRecipeHash ||
                  !teamMetaRecipeHash ||
                  loadedRecipeHash === teamMetaRecipeHash
                }
                onClick={() => setPublishOpen(true)}
                className="rounded-[var(--ck-radius-sm)] bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50"
              >
                {publishing ? "Publishing…" : "Publish changes"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteOpen(true)}
                className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
              >
                Delete Team
              </button>
            </div>
          </div>

          <div className="ck-glass-strong p-4">
            <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Notes</div>

            <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3">
              <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Parent recipe (locked)</div>
              <select
                disabled
                className="mt-2 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)] disabled:opacity-70"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
              >
                {teamRecipes.map((r) => (
                  <option key={`${r.source}:${r.id}`} value={r.id}>
                    {r.id} ({r.source})
                  </option>
                ))}
              </select>
              {lockedFromId ? (
                <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
                  <code>{lockedFromId}</code>
                  {lockedFromName ? ` (${lockedFromName})` : ""}
                </div>
              ) : provenanceMissing ? (
                <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
                  Provenance not found for this team. The parent recipe above is a best-guess.
                </div>
              ) : null}


            </div>

            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[color:var(--ck-text-secondary)]">
              <li>
                <strong>Save</strong> writes/overwrites the custom recipe file identified by “Team id”.
              </li>
              <li>
                <strong>Publish changes</strong> re-scaffolds this team from your current custom recipe and applies config (complete overwrite).
              </li>
              <li>
                <strong>Delete Team</strong> runs the safe uninstall command (<code>openclaw recipes remove-team</code>).
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {activeTab === "agents" ? (
        <div className="mt-6 ck-glass-strong p-4">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Agents in this team</div>
          <p className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">
            Add/remove agents by updating the <code>agents:</code> list in your custom team recipe (<code>{toId}</code>).
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[color:var(--ck-text-secondary)]">Role</label>
              <select
                value={newRole}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewRole(v);
                  if (v === "__custom__") {
                    setCustomRole("");
                    setNewRoleName("");
                    return;
                  }
                  setCustomRole("");
                  const match = recipeAgents.find((a) => a.role === v);
                  setNewRoleName(match?.name || "");
                }}
                className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
              >
                <option value="">Select…</option>
                {recipeAgents.map((a) => (
                  <option key={a.role} value={a.role}>
                    {a.name || a.role}
                  </option>
                ))}
                <option value="__custom__">Other…</option>
              </select>

              {newRole === "__custom__" ? (
                <input
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="role (e.g. researcher)"
                  className="mt-2 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                />
              ) : null}

              <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">
                This writes to the recipe’s <code>agents:</code> list.
              </div>
            </div>

            <div className="sm:col-span-2">
              <div>
                <label className="block text-xs font-medium text-[color:var(--ck-text-secondary)]">Name (optional)</label>
                <input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Onchain Researcher"
                  className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={saving || !derivedRole}
              onClick={async () => {
                setSaving(true);
                try {
                  try {
                    await ensureCustomRecipeExists({ overwrite: false });
                  } catch (e: unknown) {
                    // If the custom recipe already exists, proceed; we only needed to ensure a workspace file exists.
                    // Note: /api/recipes/clone returns 409 in this case.
                    const msg = e instanceof Error ? e.message : String(e);
                    if (!/Recipe id already exists:/i.test(msg)) throw e;
                  }
                  const res = await fetch("/api/recipes/team-agents", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(
                      newRole === "__custom__"
                        ? {
                            recipeId: toId.trim(),
                            op: "add",
                            role: derivedRole,
                            name: newRoleName,
                          }
                        : {
                            recipeId: toId.trim(),
                            op: "addLike",
                            baseRole: derivedRole,
                            teamId,
                            name: newRoleName,
                          },
                    ),
                  });
                  const json = await res.json();
                  if (!res.ok || !json.ok) throw new Error(json.error || "Failed updating agents list");
                  setContent(String(json.content ?? content));

                  // Immediately install/create the new agent by applying config and scaffolding missing files.
                  // Do not overwrite existing recipe-managed files.
                  try {
                    const sync = await fetch("/api/scaffold", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        kind: "team",
                        recipeId: toId.trim(),
                        teamId,
                        applyConfig: true,
                        overwrite: false,
                        allowExisting: true,
                        cronInstallChoice: "no",
                      }),
                    });
                    const syncJson = await sync.json();
                    if (!sync.ok) throw new Error(syncJson.error || "Failed to apply config / scaffold team");
                  } catch (e: unknown) {
                    // Non-fatal: recipe change is still saved.
                    flashMessage(e instanceof Error ? e.message : String(e), "error");
                  }

                  // Poll for new agent to appear; only restart gateway if needed.
                  const expectedAgentId = typeof (json as { addedAgentId?: unknown }).addedAgentId === "string" ? (json as { addedAgentId?: string }).addedAgentId : "";

                  async function refreshAgentsOnce() {
                    const agentsRes = await fetch("/api/agents", { cache: "no-store" });
                    const agentsJson = (await agentsRes.json()) as { agents?: unknown[] };
                    if (!agentsRes.ok) return { ok: false as const, hasExpected: false as const, agents: [] as Array<{ id: string; identityName?: string }> };
                    const all = Array.isArray(agentsJson.agents) ? agentsJson.agents : [];
                    const filtered = all.filter((a) => String((a as { id?: unknown }).id ?? "").startsWith(`${teamId}-`));
                    const mapped = filtered.map((a) => {
                      const agent = a as { id?: unknown; identityName?: unknown };
                      return {
                        id: String(agent.id ?? ""),
                        identityName: typeof agent.identityName === "string" ? agent.identityName : undefined,
                      };
                    });
                    const hasExpected = expectedAgentId ? mapped.some((a) => a.id === expectedAgentId) : false;
                    return { ok: true as const, hasExpected, agents: mapped };
                  }

                  async function pollAgents(maxMs: number) {
                    const start = Date.now();
                    while (Date.now() - start < maxMs) {
                      try {
                        const r = await refreshAgentsOnce();
                        if (r.ok) {
                          setTeamAgents(r.agents);
                          if (!expectedAgentId || r.hasExpected) return true;
                        }
                      } catch {
                        // ignore
                      }
                      await new Promise((res) => setTimeout(res, 500));
                    }
                    return false;
                  }

                  const appeared = await pollAgents(5000);
                  if (!appeared && expectedAgentId) {
                    // Background-ish restart: do it only if needed.
                    try {
                      void fetch("/api/gateway/restart", { method: "POST" });
                    } catch {
                      // ignore
                    }
                    await pollAgents(10000);
                  }

                  flashMessage(`Updated agents list in ${toId}`, "success");
                } catch (e: unknown) {
                  flashMessage(e instanceof Error ? e.message : String(e), "error");
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
            >
              Add agent
            </button>
            {/* remove-agent UI intentionally omitted */}
          </div>

          <div className="mt-6">
            <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Detected installed team agents (read-only)</div>
            <ul className="mt-2 space-y-2">
              {teamAgents.length ? (
                teamAgents.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[color:var(--ck-text-primary)]">
                        {a.identityName || a.id}
                      </div>
                      <div className="text-xs text-[color:var(--ck-text-secondary)]">{a.id}</div>
                    </div>
                    <a
                      className="text-sm font-medium text-[color:var(--ck-accent-red)] hover:text-[color:var(--ck-accent-red-hover)]"
                      href={`/agents/${encodeURIComponent(a.id)}?returnTo=${encodeURIComponent(`/teams/${teamId}?tab=agents`)}`}
                    >
                      Edit
                    </a>
                  </li>
                ))
              ) : teamAgentsLoading ? (
                <li className="text-sm text-[color:var(--ck-text-secondary)]">Loading…</li>
              ) : (
                <li className="text-sm text-[color:var(--ck-text-secondary)]">No team agents detected.</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {activeTab === "skills" ? (
        <div className="mt-6 ck-glass-strong p-4">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Skills</div>
          <p className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">
            Skills installed in this <strong>team</strong> workspace (<code>skills/</code>). These are available to all agents in the team.
            For agent-specific skills, open the agent from the Agents tab.
          </p>

          <div className="mt-4">
            <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Installed</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--ck-text-secondary)]">
              {skillsList.length ? skillsList.map((s) => <li key={s}>{s}</li>) : <li>None installed.</li>}
            </ul>
          </div>

          <div className="mt-5 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/15 p-3">
            <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Add a skill</div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedSkill}
                onChange={(e) => setSelectedSkill(e.target.value)}
                className="w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                disabled={installingSkill || skillsLoading || !availableSkills.length}
              >
                {availableSkills.length ? (
                  availableSkills.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))
                ) : (
                  <option value="">No skills found</option>
                )}
              </select>
              <button
                type="button"
                disabled={installingSkill || skillsLoading || !selectedSkill}
                onClick={async () => {
                  setInstallingSkill(true);
                  setTeamSkillMsg("");
                  setTeamSkillError("");
                  try {
                    const res = await fetch("/api/teams/skills/install", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ teamId, skill: selectedSkill }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok) throw new Error(json.error || "Failed to install skill");
                    setTeamSkillMsg(`Installed skill: ${selectedSkill}`);

                    // Refresh installed list.
                    const r = await fetch(`/api/teams/skills?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
                    const j = await r.json();
                    if (r.ok && j.ok) setSkillsList(Array.isArray(j.skills) ? (j.skills as string[]) : []);
                  } catch (e: unknown) {
                    setTeamSkillError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setInstallingSkill(false);
                  }
                }}
                className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
              >
                {installingSkill ? "Adding…" : "Add"}
              </button>
            </div>
            {teamSkillError ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {teamSkillError}
              </div>
            ) : null}

            {teamSkillMsg ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                {teamSkillMsg}
              </div>
            ) : null}

            <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
              This uses <code>openclaw recipes install-skill &lt;skill&gt; --team-id {teamId} --yes</code>.
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "cron" ? (
        <div className="mt-6 ck-glass-strong p-4">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Cron jobs (filtered by team name)</div>
          <ul className="mt-3 space-y-3">
            {cronJobs.length ? (
              cronJobs.map((j) => {
                const job = j as {
                  id?: unknown;
                  jobId?: unknown;
                  name?: unknown;
                  enabled?: unknown;
                  state?: { enabled?: unknown };
                };
                const id = String(job.id ?? job.jobId ?? "").trim();
                const key = id || String(job.name ?? "job");
                const label = String(job.name ?? job.id ?? job.jobId ?? "(unnamed)");
                const enabled = job.enabled ?? job.state?.enabled;

                async function act(action: "enable" | "disable" | "run") {
                  setSaving(true);
                                    try {
                    const res = await fetch("/api/cron/job", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ id, action }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok) throw new Error(json.error || "Cron action failed");
                    flashMessage(`Cron ${action}: ${label}`, "success");
                  } catch (e: unknown) {
                    flashMessage(e instanceof Error ? e.message : String(e), "error");
                  } finally {
                    setSaving(false);
                  }
                }

                return (
                  <li key={key} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3">
                    <div className="font-medium text-[color:var(--ck-text-primary)]">{label}</div>
                    <div className="mt-1 text-xs text-[color:var(--ck-text-secondary)]">Enabled: {String(enabled ?? "?")}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        disabled={saving || !id}
                        onClick={() => act("run")}
                        className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10 disabled:opacity-50"
                      >
                        Run
                      </button>
                      <button
                        disabled={saving || !id}
                        onClick={() => act("enable")}
                        className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10 disabled:opacity-50"
                      >
                        Enable
                      </button>
                      <button
                        disabled={saving || !id}
                        onClick={() => act("disable")}
                        className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10 disabled:opacity-50"
                      >
                        Disable
                      </button>
                      {!id ? (
                        <div className="text-xs text-[color:var(--ck-text-tertiary)]">(missing id)</div>
                      ) : null}
                    </div>
                  </li>
                );
              })
            ) : cronLoading ? (
              <li className="text-sm text-[color:var(--ck-text-secondary)]">Loading…</li>
            ) : (
              <li className="text-sm text-[color:var(--ck-text-secondary)]">No cron jobs detected for this team.</li>
            )}
          </ul>
        </div>
      ) : null}

      {activeTab === "workflows" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={workflowEditorOpen ? "ck-glass-strong p-4" : "ck-glass-strong p-4 lg:col-span-3"}>
            <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Workflows (file-first)</div>
            <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
              Stored in <code>shared-context/workflows/&lt;id&gt;.workflow.json</code> inside the team workspace.
            </div>

            {workflowFilesError ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {workflowFilesError}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={workflowSaving}
                onClick={() => {
                  setWorkflowCreateId("new-workflow");
                  setWorkflowCreateName("New workflow");
                  setWorkflowCreateOpen(true);
                }}
                className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
              >
                Add workflow
              </button>

              {workflowFiles.length === 0 ? (
                <button
                  disabled={workflowSaving}
                  onClick={async () => {
                    setWorkflowSaving(true);
                    setWorkflowFilesError("");
                    try {
                      // Create the MVP built-in template (Marketing Cadence v1) for THIS TEAM.
                      const workflow: WorkflowFileV1 = {
                      schema: "clawkitchen.workflow.v1",
                      id: "marketing-cadence",
                      name: "Marketing Cadence (v1)",
                      version: 1,
                      timezone: "America/New_York",
                      triggers: [
                        { kind: "cron", id: "content-cadence", name: "Content cadence", enabled: true, expr: "0 9 * * 1,3,5", tz: "America/New_York" },
                        { kind: "cron", id: "seasonal-scan", name: "Seasonal scan", enabled: true, expr: "0 8 * * *", tz: "America/New_York" },
                        { kind: "cron", id: "weekly-recap", name: "Weekly recap", enabled: false, expr: "30 9 * * 1", tz: "America/New_York" },
                      ],
                      nodes: [
                        { id: "start", type: "start", name: "Start", x: 80, y: 80 },
                        { id: "research", type: "llm", name: "Research", x: 320, y: 80 },
                        { id: "draft_assets", type: "llm", name: "Draft assets", x: 560, y: 80 },
                        { id: "qc_brand", type: "llm", name: "QC brand", x: 800, y: 80 },
                        { id: "approval", type: "human_approval", name: "Approval", x: 1040, y: 80 },
                        { id: "post_x", type: "tool", name: "Post: X", x: 1040, y: 240 },
                        { id: "post_instagram", type: "tool", name: "Post: Instagram", x: 1040, y: 360 },
                        { id: "post_tiktok", type: "tool", name: "Post: TikTok", x: 1040, y: 480 },
                        { id: "post_youtube", type: "tool", name: "Post: YouTube", x: 1040, y: 600 },
                        { id: "writeback", type: "tool", name: "Writeback", x: 800, y: 600 },
                        { id: "end", type: "end", name: "End", x: 560, y: 600 },
                      ],
                      edges: [
                        { id: "e1", from: "start", to: "research" },
                        { id: "e2", from: "research", to: "draft_assets" },
                        { id: "e3", from: "draft_assets", to: "qc_brand" },
                        { id: "e4", from: "qc_brand", to: "approval" },
                        { id: "e5", from: "approval", to: "post_x", label: "approve" },
                        { id: "e6", from: "post_x", to: "post_instagram" },
                        { id: "e7", from: "post_instagram", to: "post_tiktok" },
                        { id: "e8", from: "post_tiktok", to: "post_youtube" },
                        { id: "e9", from: "post_youtube", to: "writeback" },
                        { id: "e10", from: "writeback", to: "end" },
                      ],
                      meta: {
                        templateId: "marketing-cadence-v1",
                        approvalGateRequired: true,
                      },
                    };

                    const res = await fetch("/api/teams/workflows", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ teamId, workflow }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok) throw new Error(json.error || "Failed to write workflow");

                    // Refresh list
                    const listRes = await fetch(`/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
                    const listJson = await listRes.json();
                    if (listRes.ok && listJson.ok) {
                      const files = Array.isArray(listJson.files) ? listJson.files : [];
                      const list = files.map((f: unknown) => String(f ?? "").trim()).filter((f: string) => Boolean(f));
                      setWorkflowFiles(list);
                      setSelectedWorkflowFile("marketing-cadence.workflow.json");
                      setWorkflowJsonText(JSON.stringify(workflow, null, 2) + "\n");
                      setWorkflowEditorOpen(true);
                    }

                    flashMessage("Created workflow template: marketing-cadence", "success");
                  } catch (e: unknown) {
                    setWorkflowFilesError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setWorkflowSaving(false);
                  }
                }}
                className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
              >
                {workflowSaving ? "Working…" : "Create Marketing Cadence template"}
              </button>
              ) : null}

              <button
                disabled={workflowSaving}
                onClick={async () => {
                  setWorkflowSaving(true);
                  setWorkflowFilesError("");
                  try {
                    const res = await fetch(`/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
                    const json = await res.json();
                    if (!res.ok || !json.ok) throw new Error(json.error || "Failed to list workflows");
                    const files = Array.isArray(json.files) ? json.files : [];
                    const list = files.map((f: unknown) => String(f ?? "").trim()).filter((f: string) => Boolean(f));
                    setWorkflowFiles(list);
                    flashMessage("Refreshed workflow list", "success");
                  } catch (e: unknown) {
                    setWorkflowFilesError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setWorkflowSaving(false);
                  }
                }}
                className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {workflowCreateOpen ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
                <div className="ck-glass-strong w-full max-w-lg rounded-[var(--ck-radius-lg)] border border-white/10 p-4 shadow-[var(--ck-shadow-2)]">
                  <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Create workflow</div>
                  <div className="mt-1 text-xs text-[color:var(--ck-text-tertiary)]">Creates a new file under shared-context/workflows/ for this team.</div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="grid gap-1">
                      <span className="text-xs text-[color:var(--ck-text-secondary)]">Workflow id</span>
                      <input
                        value={workflowCreateId}
                        onChange={(e) => setWorkflowCreateId(e.target.value)}
                        className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                        placeholder="e.g. marketing-cadence"
                      />
                      <span className="text-xs text-[color:var(--ck-text-tertiary)]">lowercase letters, numbers, dashes</span>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs text-[color:var(--ck-text-secondary)]">Name</span>
                      <input
                        value={workflowCreateName}
                        onChange={(e) => setWorkflowCreateName(e.target.value)}
                        className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 px-3 py-2 text-sm text-[color:var(--ck-text-primary)]"
                        placeholder="New workflow"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkflowCreateOpen(false)}
                      className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const safeId = String(workflowCreateId || "").trim();
                        if (!safeId) {
                          flashMessage("Workflow id is required", "error");
                          return;
                        }

                        const workflow: WorkflowFileV1 = {
                          schema: "clawkitchen.workflow.v1",
                          id: safeId,
                          name: String(workflowCreateName || safeId),
                          version: 1,
                          timezone: "America/New_York",
                          triggers: [],
                          nodes: [
                            { id: "start", type: "start", name: "Start", x: 120, y: 120 },
                            { id: "end", type: "end", name: "End", x: 420, y: 120 },
                          ],
                          edges: [{ id: "e1", from: "start", to: "end" }],
                          meta: {},
                        };

                        setSelectedWorkflowFile(`${safeId}.workflow.json`);
                        setWorkflowJsonText(JSON.stringify(workflow, null, 2) + "\n");
                        setWorkflowCreateOpen(false);
                        setWorkflowEditorOpen(true);
                      }}
                      className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)]"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 text-xs font-medium text-[color:var(--ck-text-secondary)]">Files</div>
            <ul className="mt-2 space-y-1">
              {workflowFilesLoading ? <li className="text-sm text-[color:var(--ck-text-secondary)]">Loading…</li> : null}
              {workflowFiles.length ? (
                workflowFiles.map((f) => {
                  const isActive = selectedWorkflowFile === f;
                  return (
                    <li key={f} className="flex items-center justify-between gap-3 rounded-[var(--ck-radius-sm)] px-2 py-1 hover:bg-white/5">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkflowFile(f)}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <span className={isActive ? "text-green-400" : "text-white/25"}>{isActive ? "✓" : "•"}</span>
                        <span
                          className={
                            isActive
                              ? "truncate text-base font-medium text-[color:var(--ck-text-primary)]"
                              : "truncate text-base text-[color:var(--ck-text-secondary)]"
                          }
                        >
                          {f}
                        </span>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={workflowSaving}
                          onClick={async () => {
                            setSelectedWorkflowFile(f);
                            setWorkflowSaving(true);
                            setWorkflowFilesError("");
                            try {
                              const id = String(f).replace(/\.workflow\.json$/i, "");
                              const res = await fetch(
                                `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}&id=${encodeURIComponent(id)}`,
                                { cache: "no-store" }
                              );
                              const json = await res.json();
                              if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load workflow");
                              setWorkflowJsonText(JSON.stringify(json.workflow, null, 2) + "\n");
                              setWorkflowEditorOpen(true);
                            } catch (e: unknown) {
                              setWorkflowFilesError(e instanceof Error ? e.message : String(e));
                            } finally {
                              setWorkflowSaving(false);
                            }
                          }}
                          className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10 disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={workflowSaving}
                          onClick={async () => {
                            if (!confirm(`Delete workflow ${f}?`)) return;
                            setWorkflowSaving(true);
                            setWorkflowFilesError("");
                            try {
                              const id = String(f).replace(/\.workflow\.json$/i, "");
                              const res = await fetch(
                                `/api/teams/workflows?teamId=${encodeURIComponent(teamId)}&id=${encodeURIComponent(id)}`,
                                { method: "DELETE" }
                              );
                              const json = await res.json();
                              if (!res.ok || !json.ok) throw new Error(json.error || "Failed to delete workflow");

                              const listRes = await fetch(`/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
                              const listJson = await listRes.json();
                              if (listRes.ok && listJson.ok) {
                                const files = Array.isArray(listJson.files) ? listJson.files : [];
                                const list = files.map((x: unknown) => String(x ?? "").trim()).filter((x: string) => Boolean(x));
                                setWorkflowFiles(list);
                              }

                              if (selectedWorkflowFile === f) {
                                setSelectedWorkflowFile("");
                                setWorkflowJsonText("");
                              }

                              flashMessage(`Deleted workflow: ${f}`, "success");
                            } catch (e: unknown) {
                              setWorkflowFilesError(e instanceof Error ? e.message : String(e));
                            } finally {
                              setWorkflowSaving(false);
                            }
                          }}
                          className="rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 shadow-[var(--ck-shadow-1)] hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })
              ) : !workflowFilesLoading ? (
                <li className="text-sm text-[color:var(--ck-text-secondary)]">No workflows yet.</li>
              ) : null}
            </ul>
          </div>

          {workflowEditorOpen ? (
            <div className="fixed inset-0 z-50 bg-black/70">
              <div className="ck-glass-strong h-full w-full overflow-hidden border border-white/10 shadow-[var(--ck-shadow-2)]">
                <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">
                    Workflow editor{selectedWorkflowFile ? ` — ${selectedWorkflowFile}` : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkflowEditorOpen(false)}
                    className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>

                <div className="h-[calc(100%-3rem)] overflow-auto p-4">
                  <div className="ck-glass-strong p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Workflow editor</div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-[var(--ck-radius-sm)] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setWorkflowView("canvas")}
                    className={
                      workflowView === "canvas"
                        ? "bg-white/10 px-3 py-2 text-xs font-medium text-[color:var(--ck-text-primary)]"
                        : "bg-transparent px-3 py-2 text-xs font-medium text-[color:var(--ck-text-secondary)] hover:bg-white/5"
                    }
                  >
                    Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkflowView("json")}
                    className={
                      workflowView === "json"
                        ? "bg-white/10 px-3 py-2 text-xs font-medium text-[color:var(--ck-text-primary)]"
                        : "bg-transparent px-3 py-2 text-xs font-medium text-[color:var(--ck-text-secondary)] hover:bg-white/5"
                    }
                  >
                    JSON
                  </button>
                </div>

                <input
                  ref={workflowImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    // Reset the input so re-importing the same file still triggers onChange.
                    e.target.value = "";
                    if (!file) return;

                    setWorkflowFilesError("");
                    try {
                      const text = await file.text();
                      const parsed = JSON.parse(text) as WorkflowFileV1;
                      setWorkflowJsonText(JSON.stringify(parsed, null, 2) + "\n");
                      setSelectedWorkflowFile("");
                      flashMessage(`Imported workflow JSON: ${parsed.id || file.name}`, "success");
                    } catch (err: unknown) {
                      setWorkflowFilesError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                />

                <button
                  type="button"
                  disabled={workflowSaving}
                  onClick={() => workflowImportInputRef.current?.click()}
                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10 disabled:opacity-50"
                >
                  Import
                </button>

                <button
                  type="button"
                  disabled={workflowSaving || !workflowParsed || Boolean(workflowParseError) || workflowValidation.errors.length > 0}
                  onClick={() => {
                    setWorkflowFilesError("");
                    try {
                      const wf = workflowParsed;
                      if (!wf) throw new Error("No workflow loaded");
                      if (workflowParseError) throw new Error(`Invalid JSON: ${workflowParseError}`);
                      if (workflowValidation.errors.length) throw new Error("Fix workflow validation errors before exporting");

                      const filename = `${wf.id || "workflow"}.workflow.json`;
                      const blob = new Blob([JSON.stringify(wf, null, 2) + "\n"], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                      flashMessage(`Exported: ${filename}`, "success");
                    } catch (err: unknown) {
                      setWorkflowFilesError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--ck-text-primary)] shadow-[var(--ck-shadow-1)] hover:bg-white/10 disabled:opacity-50"
                >
                  Export
                </button>

                <button
                  disabled={workflowSaving || !workflowParsed || Boolean(workflowParseError) || workflowValidation.errors.length > 0}
                  onClick={async () => {
                    setWorkflowSaving(true);
                    setWorkflowFilesError("");
                    try {
                      const wf = workflowParsed;
                      if (!wf) throw new Error("No workflow loaded");
                      if (workflowParseError) throw new Error(`Invalid JSON: ${workflowParseError}`);
                      if (workflowValidation.errors.length) throw new Error("Fix workflow validation errors before saving");

                      const res = await fetch("/api/teams/workflows", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ teamId, workflow: wf }),
                      });
                      const json = await res.json();
                      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save workflow");
                      flashMessage(`Saved workflow: ${wf.id}`, "success");

                      const listRes = await fetch(`/api/teams/workflows?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
                      const listJson = await listRes.json();
                      if (listRes.ok && listJson.ok) {
                        const files = Array.isArray(listJson.files) ? listJson.files : [];
                        const list = files.map((f: unknown) => String(f ?? "").trim()).filter((f: string) => Boolean(f));
                        setWorkflowFiles(list);
                        setSelectedWorkflowFile(`${wf.id}.workflow.json`);
                      }
                    } catch (e: unknown) {
                      setWorkflowFilesError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setWorkflowSaving(false);
                    }
                  }}
                  className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
                >
                  {workflowSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {workflowParseError ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                JSON parse error: {workflowParseError}
              </div>
            ) : null}

            {!workflowParseError && workflowValidation.errors.length ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                <div className="font-medium">Workflow validation errors</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {workflowValidation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!workflowParseError && !workflowValidation.errors.length && workflowValidation.warnings.length ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                <div className="font-medium">Workflow validation warnings</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {workflowValidation.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {workflowView === "canvas" ? (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
                <div className="lg:col-span-3">
                  <div
                    ref={workflowCanvasRef}
                    className="relative h-[calc(100vh-20rem)] min-h-[55vh] w-full overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20"
                  >
                    <div className="relative h-[900px] w-[1400px]">
                      <svg className="absolute inset-0" width={1400} height={900}>
                        {(workflowParsed?.edges ?? []).map((e) => {
                          const wf = workflowParsed;
                          if (!wf) return null;
                          const a = wf.nodes.find((n) => n.id === e.from);
                          const b = wf.nodes.find((n) => n.id === e.to);
                          if (!a || !b) return null;

                          const ax = (typeof a.x === "number" ? a.x : 80) + 90;
                          const ay = (typeof a.y === "number" ? a.y : 80) + 24;
                          const bx = (typeof b.x === "number" ? b.x : 80) + 90;
                          const by = (typeof b.y === "number" ? b.y : 80) + 24;

                          return (
                            <g key={e.id}>
                              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
                              {e.label ? (
                                <text x={(ax + bx) / 2} y={(ay + by) / 2 - 6} fill="rgba(255,255,255,0.55)" fontSize={10} textAnchor="middle">
                                  {e.label}
                                </text>
                              ) : null}
                            </g>
                          );
                        })}
                      </svg>

                      {(workflowParsed?.nodes ?? []).map((n, idx) => {
                        const x = typeof n.x === "number" ? n.x : 80 + idx * 220;
                        const y = typeof n.y === "number" ? n.y : 80;
                        const selected = workflowSelectedNodeId === n.id;

                        return (
                          <div
                            key={n.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setWorkflowSelectedNodeId(n.id)}
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              const el = workflowCanvasRef.current;
                              if (!el) return;
                              const rect = el.getBoundingClientRect();
                              const dx = e.clientX - rect.left - x;
                              const dy = e.clientY - rect.top - y;
                              setWorkflowSelectedNodeId(n.id);
                              setWorkflowDragging({ nodeId: n.id, dx, dy, containerLeft: rect.left, containerTop: rect.top });
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

                  <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
                    Tip: click a node to inspect it; drag to reposition. Positions are stored in the workflow JSON (file-first).
                  </div>
                </div>

                <div className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/20 p-3 lg:col-span-1">
                  <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Workflow</div>

                  {workflowParsed ? (
                    (() => {
                      const wf = workflowParsed;
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
                                const next: WorkflowFileV1 = { ...wf, timezone: nextTz };
                                setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                    const nextMeta = { ...meta, approvalProvider: nextProvider };
                                    const next: WorkflowFileV1 = { ...wf, meta: nextMeta };
                                    setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                    const nextMeta = { ...meta, approvalTarget: nextTarget };
                                    const next: WorkflowFileV1 = { ...wf, meta: nextMeta };
                                    setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                  }}
                                  className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                  placeholder="(e.g. Telegram chat id)"
                                />
                                <div className="mt-1 text-[10px] text-[color:var(--ck-text-tertiary)]">
                                  If set, sample runs that reach a human-approval node will send an approval packet via the gateway message tool.
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
                                  const next: WorkflowFileV1 = {
                                    ...wf,
                                    triggers: [
                                      ...triggers,
                                      { kind: "cron", id, name: "New trigger", enabled: true, expr: "0 9 * * 1-5", tz },
                                    ],
                                  };
                                  setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                          onClick={() => {
                                            const next: WorkflowFileV1 = { ...wf, triggers: triggers.filter((_, idx) => idx !== i) };
                                            setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                          }}
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
                                              const next: WorkflowFileV1 = {
                                                ...wf,
                                                triggers: triggers.map((x, idx) =>
                                                  idx === i ? (x.kind === "cron" ? { ...x, enabled: nextEnabled } : x) : x
                                                ),
                                              };
                                              setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                              const next: WorkflowFileV1 = {
                                                ...wf,
                                                triggers: triggers.map((x, idx) =>
                                                  idx === i ? (x.kind === "cron" ? { ...x, name: nextName } : x) : x
                                                ),
                                              };
                                              setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                              const next: WorkflowFileV1 = {
                                                ...wf,
                                                triggers: triggers.map((x, idx) =>
                                                  idx === i ? (x.kind === "cron" ? { ...x, expr: nextExpr } : x) : x
                                                ),
                                              };
                                              setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                                const next: WorkflowFileV1 = {
                                                  ...wf,
                                                  triggers: triggers.map((x, idx) =>
                                                    idx === i ? (x.kind === "cron" ? { ...x, expr: nextExpr } : x) : x
                                                  ),
                                                };
                                                setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                                              const next: WorkflowFileV1 = {
                                                ...wf,
                                                triggers: triggers.map((x, idx) =>
                                                  idx === i ? (x.kind === "cron" ? { ...x, tz: nextTz } : x) : x
                                                ),
                                              };
                                              setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
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
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Runs (history)</div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={workflowSaving}
                                  onClick={async () => {
                                    const wfId = String(wf.id ?? "").trim();
                                    if (!wfId) return;
                                    setWorkflowRunsError("");
                                    try {
                                      const res = await fetch("/api/teams/workflow-runs", {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({ teamId, workflowId: wfId, mode: "sample" }),
                                      });
                                      const json = await res.json();
                                      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to create sample run");

                                      const listRes = await fetch(
                                        `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(wfId)}`,
                                        { cache: "no-store" }
                                      );
                                      const listJson = await listRes.json();
                                      if (!listRes.ok || !listJson.ok) throw new Error(listJson.error || "Failed to refresh runs");
                                      const files = Array.isArray(listJson.files) ? listJson.files : [];
                                      const list = files.map((f: unknown) => String(f ?? "").trim()).filter((f: string) => Boolean(f));
                                      setWorkflowRuns(list);
                                      flashMessage("Created sample run", "success");
                                    } catch (e: unknown) {
                                      setWorkflowRunsError(e instanceof Error ? e.message : String(e));
                                    }
                                  }}
                                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10 disabled:opacity-50"
                                >
                                  + Sample run
                                </button>
                              </div>
                            </div>

                            {workflowRunsError ? (
                              <div className="mt-2 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-100">
                                {workflowRunsError}
                              </div>
                            ) : null}

                            <div className="mt-2 space-y-1">
                              {workflowRunsLoading ? (
                                <div className="text-xs text-[color:var(--ck-text-secondary)]">Loading runs…</div>
                              ) : workflowRuns.length ? (
                                workflowRuns.slice(0, 8).map((f) => {
                                  const runId = String(f).replace(/\.run\.json$/i, "");
                                  const selected = selectedWorkflowRunId === runId;
                                  return (
                                    <button
                                      key={f}
                                      type="button"
                                      onClick={async () => {
                                        const wfId = String(wf.id ?? "").trim();
                                        if (!wfId) return;
                                        setSelectedWorkflowRunId(runId);
                                        setSelectedWorkflowRun(null);
                                        setWorkflowRunsError("");
                                        try {
                                          const res = await fetch(
                                            `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(wfId)}&runId=${encodeURIComponent(runId)}`,
                                            { cache: "no-store" }
                                          );
                                          const json = await res.json();
                                          if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load run");
                                          setSelectedWorkflowRun(json.run);
                                        } catch (e: unknown) {
                                          setWorkflowRunsError(e instanceof Error ? e.message : String(e));
                                        }
                                      }}
                                      className={
                                        selected
                                          ? "w-full rounded-[var(--ck-radius-sm)] bg-white/10 px-2 py-1 text-left text-[11px] text-[color:var(--ck-text-primary)]"
                                          : "w-full rounded-[var(--ck-radius-sm)] px-2 py-1 text-left text-[11px] text-[color:var(--ck-text-secondary)] hover:bg-white/5"
                                      }
                                    >
                                      {runId}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="text-xs text-[color:var(--ck-text-secondary)]">No runs yet.</div>
                              )}
                            </div>

                            {selectedWorkflowRun ? (
                              (() => {
                                const run =
                                  selectedWorkflowRun && typeof selectedWorkflowRun === "object"
                                    ? (selectedWorkflowRun as Record<string, unknown>)
                                    : ({} as Record<string, unknown>);
                                const nodesVal = (run as Record<string, unknown>).nodes;
                                const nodes = Array.isArray(nodesVal) ? (nodesVal as unknown[]) : [];
                                return (
                                  <div className="mt-2 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-[11px] font-medium text-[color:var(--ck-text-primary)]">Run detail</div>
                                      <div className="text-[10px] text-[color:var(--ck-text-tertiary)]">
                                        <span className="font-mono">{String(run?.status ?? "")}</span>
                                        {run?.startedAt ? <span> · {String(run.startedAt)}</span> : null}
                                      </div>
                                    </div>

                                    {run?.summary ? (
                                      <div className="mt-1 text-[11px] text-[color:var(--ck-text-secondary)]">{String(run.summary)}</div>
                                    ) : null}

                                    {(() => {
                                      const status = String(run?.status ?? "");
                                      const approvalVal = (run as Record<string, unknown>).approval;
                                      const approval =
                                        approvalVal && typeof approvalVal === "object" ? (approvalVal as Record<string, unknown>) : ({} as Record<string, unknown>);
                                      const approvalState = String(approval.state ?? "");
                                      const approvalNodeId = String(approval.nodeId ?? "");
                                      const canAct = status === "waiting_for_approval" && approvalState === "pending" && approvalNodeId;

                                      if (!canAct) return null;

                                      return (
                                        <div className="mt-2 rounded-[var(--ck-radius-sm)] border border-amber-300/30 bg-amber-500/10 p-2">
                                          <div className="text-[10px] uppercase tracking-wide text-amber-100">approval required</div>
                                          <div className="mt-1 text-[11px] text-amber-50">
                                            Waiting on <span className="font-mono">{approvalNodeId}</span>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const wfId = String(wf.id ?? "").trim();
                                                const rId = String((run as Record<string, unknown>).id ?? "").trim();
                                                if (!wfId || !rId) return;
                                                setWorkflowRunsError("");
                                                try {
                                                  const res = await fetch("/api/teams/workflow-runs", {
                                                    method: "POST",
                                                    headers: { "content-type": "application/json" },
                                                    body: JSON.stringify({ teamId, workflowId: wfId, runId: rId, action: "approve" }),
                                                  });
                                                  const json = await res.json();
                                                  if (!res.ok || !json.ok) throw new Error(json.error || "Failed to approve");

                                                  const detailRes = await fetch(
                                                    `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(wfId)}&runId=${encodeURIComponent(rId)}`,
                                                    { cache: "no-store" }
                                                  );
                                                  const detailJson = await detailRes.json();
                                                  if (!detailRes.ok || !detailJson.ok) throw new Error(detailJson.error || "Failed to reload run");
                                                  setSelectedWorkflowRun(detailJson.run);
                                                  flashMessage("Approved", "success");
                                                } catch (e: unknown) {
                                                  setWorkflowRunsError(e instanceof Error ? e.message : String(e));
                                                }
                                              }}
                                              className="rounded-[var(--ck-radius-sm)] border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-50 hover:bg-emerald-500/20"
                                            >
                                              Approve &amp; continue
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const wfId = String(wf.id ?? "").trim();
                                                const rId = String((run as Record<string, unknown>).id ?? "").trim();
                                                if (!wfId || !rId) return;
                                                setWorkflowRunsError("");
                                                try {
                                                  const res = await fetch("/api/teams/workflow-runs", {
                                                    method: "POST",
                                                    headers: { "content-type": "application/json" },
                                                    body: JSON.stringify({ teamId, workflowId: wfId, runId: rId, action: "request_changes" }),
                                                  });
                                                  const json = await res.json();
                                                  if (!res.ok || !json.ok) throw new Error(json.error || "Failed to request changes");

                                                  const detailRes = await fetch(
                                                    `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(wfId)}&runId=${encodeURIComponent(rId)}`,
                                                    { cache: "no-store" }
                                                  );
                                                  const detailJson = await detailRes.json();
                                                  if (!detailRes.ok || !detailJson.ok) throw new Error(detailJson.error || "Failed to reload run");
                                                  setSelectedWorkflowRun(detailJson.run);
                                                  flashMessage("Requested changes", "success");
                                                } catch (e: unknown) {
                                                  setWorkflowRunsError(e instanceof Error ? e.message : String(e));
                                                }
                                              }}
                                              className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                                            >
                                              Request changes
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const wfId = String(wf.id ?? "").trim();
                                                const rId = String((run as Record<string, unknown>).id ?? "").trim();
                                                if (!wfId || !rId) return;
                                                setWorkflowRunsError("");
                                                try {
                                                  const res = await fetch("/api/teams/workflow-runs", {
                                                    method: "POST",
                                                    headers: { "content-type": "application/json" },
                                                    body: JSON.stringify({ teamId, workflowId: wfId, runId: rId, action: "cancel" }),
                                                  });
                                                  const json = await res.json();
                                                  if (!res.ok || !json.ok) throw new Error(json.error || "Failed to cancel");

                                                  const detailRes = await fetch(
                                                    `/api/teams/workflow-runs?teamId=${encodeURIComponent(teamId)}&workflowId=${encodeURIComponent(wfId)}&runId=${encodeURIComponent(rId)}`,
                                                    { cache: "no-store" }
                                                  );
                                                  const detailJson = await detailRes.json();
                                                  if (!detailRes.ok || !detailJson.ok) throw new Error(detailJson.error || "Failed to reload run");
                                                  setSelectedWorkflowRun(detailJson.run);
                                                  flashMessage("Canceled", "success");
                                                } catch (e: unknown) {
                                                  setWorkflowRunsError(e instanceof Error ? e.message : String(e));
                                                }
                                              }}
                                              className="rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-50 hover:bg-red-500/20"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                          <div className="mt-2 text-[10px] text-amber-100/80">
                                            Note: this is currently an in-app approval stub; channel delivery/resume wiring still TBD.
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    <div className="mt-2">
                                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">per-node results</div>
                                      {nodes.length ? (
                                        <div className="mt-1 space-y-1">
                                          {nodes.slice(0, 50).map((n, idx) => {
                                            const node = n && typeof n === "object" ? (n as Record<string, unknown>) : ({} as Record<string, unknown>);
                                            const status = String(node.status ?? "");
                                            const statusColor =
                                              status === "success"
                                                ? "text-emerald-200"
                                                : status === "error"
                                                  ? "text-red-200"
                                                  : status === "running" || status === "waiting"
                                                    ? "text-amber-200"
                                                    : "text-[color:var(--ck-text-secondary)]";
                                            const nodeId = String(node.nodeId ?? "");
                                            const errVal = node.error;
                                            const outputVal = node.output;
                                            return (
                                              <div key={`${nodeId || "node"}-${idx}`} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 p-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="text-[11px] text-[color:var(--ck-text-primary)]">
                                                    <span className="font-mono">{nodeId}</span>
                                                  </div>
                                                  <div className={`text-[10px] font-medium ${statusColor}`}>{status}</div>
                                                </div>
                                                {errVal ? (
                                                  <div className="mt-1 text-[10px] text-red-100">
                                                    {typeof errVal === "string"
                                                      ? errVal
                                                      : typeof errVal === "object" && errVal && "message" in errVal
                                                        ? String((errVal as Record<string, unknown>).message ?? "")
                                                        : String(errVal)}
                                                  </div>
                                                ) : null}
                                                {typeof outputVal !== "undefined" ? (
                                                  <pre className="mt-1 max-h-[120px] overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2 text-[10px] text-[color:var(--ck-text-secondary)]">
                                                    {JSON.stringify(outputVal, null, 2)}
                                                  </pre>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-xs text-[color:var(--ck-text-secondary)]">No node results recorded on this run yet.</div>
                                      )}
                                    </div>

                                    <details className="mt-2">
                                      <summary className="cursor-pointer select-none text-[10px] text-[color:var(--ck-text-tertiary)]">raw JSON</summary>
                                      <pre className="mt-2 max-h-[220px] overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2 text-[10px] text-[color:var(--ck-text-secondary)]">
                                        {JSON.stringify(selectedWorkflowRun, null, 2)}
                                      </pre>
                                    </details>
                                  </div>
                                );
                              })()
                            ) : null}
                          </div>

                          <div className="border-t border-white/10 pt-3">
                            <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Nodes</div>

                            <div className="mt-2 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2">
                              <div className="grid grid-cols-1 gap-2">
                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">id</div>
                                  <input
                                    value={workflowNewNodeId}
                                    onChange={(e) => setWorkflowNewNodeId(e.target.value)}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                    placeholder="e.g. draft_assets"
                                  />
                                  <div className="mt-1 text-[10px] text-[color:var(--ck-text-tertiary)]">
                                    Tip: ids are file-first + portable; use lowercase letters, numbers, and underscores.
                                  </div>
                                </label>

                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">name (optional)</div>
                                  <input
                                    value={workflowNewNodeName}
                                    onChange={(e) => setWorkflowNewNodeName(e.target.value)}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                    placeholder="Human-friendly label"
                                  />
                                </label>

                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">type</div>
                                  <select
                                    value={workflowNewNodeType}
                                    onChange={(e) => setWorkflowNewNodeType(e.target.value as WorkflowFileV1["nodes"][number]["type"])}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                  >
                                    <option value="start">start</option>
                                    <option value="end">end</option>
                                    <option value="llm">llm</option>
                                    <option value="tool">tool</option>
                                    <option value="condition">condition</option>
                                    <option value="delay">delay</option>
                                    <option value="human_approval">human_approval</option>
                                  </select>
                                </label>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const rawId = String(workflowNewNodeId || "").trim();
                                    const id = rawId.replace(/[^a-z0-9_\-]/gi, "_");
                                    if (!id) {
                                      flashMessage("Node id is required", "error");
                                      return;
                                    }
                                    if (wf.nodes.some((n) => n.id === id)) {
                                      flashMessage(`Node id already exists: ${id}`, "error");
                                      return;
                                    }

                                    const maxX = wf.nodes.reduce((acc, n) => (typeof n.x === "number" ? Math.max(acc, n.x) : acc), 80);
                                    const nextNode = {
                                      id,
                                      type: workflowNewNodeType,
                                      name: String(workflowNewNodeName || "").trim() || id,
                                      x: maxX + 220,
                                      y: 80,
                                    } as WorkflowFileV1["nodes"][number];

                                    const next: WorkflowFileV1 = { ...wf, nodes: [...wf.nodes, nextNode] };
                                    setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                    setWorkflowSelectedNodeId(id);
                                    setWorkflowNewNodeId("");
                                    setWorkflowNewNodeName("");
                                  }}
                                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                                >
                                  + Add node
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 space-y-1">
                              {wf.nodes.map((n) => {
                                const selected = workflowSelectedNodeId === n.id;
                                return (
                                  <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => setWorkflowSelectedNodeId(n.id)}
                                    className={
                                      selected
                                        ? "w-full rounded-[var(--ck-radius-sm)] bg-white/10 px-2 py-1 text-left text-[11px] text-[color:var(--ck-text-primary)]"
                                        : "w-full rounded-[var(--ck-radius-sm)] px-2 py-1 text-left text-[11px] text-[color:var(--ck-text-secondary)] hover:bg-white/5"
                                    }
                                  >
                                    <span className="font-mono">{n.id}</span>
                                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">{n.type}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-white/10 pt-3">
                            <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Edges</div>

                            <div className="mt-2 rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2">
                              <div className="grid grid-cols-1 gap-2">
                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">from</div>
                                  <select
                                    value={workflowNewEdgeFrom}
                                    onChange={(e) => setWorkflowNewEdgeFrom(e.target.value)}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                  >
                                    <option value="">(select)</option>
                                    {wf.nodes.map((n) => (
                                      <option key={n.id} value={n.id}>
                                        {n.id}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">to</div>
                                  <select
                                    value={workflowNewEdgeTo}
                                    onChange={(e) => setWorkflowNewEdgeTo(e.target.value)}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                  >
                                    <option value="">(select)</option>
                                    {wf.nodes.map((n) => (
                                      <option key={n.id} value={n.id}>
                                        {n.id}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">label (optional)</div>
                                  <input
                                    value={workflowNewEdgeLabel}
                                    onChange={(e) => setWorkflowNewEdgeLabel(e.target.value)}
                                    className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                    placeholder="e.g. approve"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const from = String(workflowNewEdgeFrom || "").trim();
                                    const to = String(workflowNewEdgeTo || "").trim();
                                    if (!from || !to) {
                                      flashMessage("Edge requires from + to", "error");
                                      return;
                                    }
                                    if (from === to) {
                                      flashMessage("Edge from/to must be different", "error");
                                      return;
                                    }
                                    const id = `e${Date.now()}`;
                                    const nextEdge: WorkflowFileV1["edges"][number] = {
                                      id,
                                      from,
                                      to,
                                      ...(String(workflowNewEdgeLabel || "").trim() ? { label: String(workflowNewEdgeLabel).trim() } : {}),
                                    };
                                    const next: WorkflowFileV1 = { ...wf, edges: [...(wf.edges ?? []), nextEdge] };
                                    setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                    setWorkflowNewEdgeLabel("");
                                  }}
                                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-[color:var(--ck-text-primary)] hover:bg-white/10"
                                >
                                  + Add edge
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 space-y-2">
                              {(wf.edges ?? []).length ? (
                                (wf.edges ?? []).map((e) => (
                                  <div key={e.id} className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-[11px] text-[color:var(--ck-text-secondary)]">
                                        <span className="font-mono">{e.from}</span> → <span className="font-mono">{e.to}</span>
                                        {e.label ? <span className="ml-2 text-[10px] text-[color:var(--ck-text-tertiary)]">({e.label})</span> : null}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next: WorkflowFileV1 = { ...wf, edges: (wf.edges ?? []).filter((x) => x.id !== e.id) };
                                          setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                        }}
                                        className="text-[10px] text-[color:var(--ck-text-tertiary)] hover:text-[color:var(--ck-text-primary)]"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-[color:var(--ck-text-secondary)]">No edges yet.</div>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-white/10 pt-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-medium text-[color:var(--ck-text-secondary)]">Node inspector</div>
                              {workflowSelectedNodeId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nodeId = workflowSelectedNodeId;
                                    const nextNodes = wf.nodes.filter((n) => n.id !== nodeId);
                                    const nextEdges = (wf.edges ?? []).filter((e) => e.from !== nodeId && e.to !== nodeId);
                                    const next: WorkflowFileV1 = { ...wf, nodes: nextNodes, edges: nextEdges };
                                    setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                    setWorkflowSelectedNodeId("");
                                  }}
                                  className="rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-red-100 hover:bg-white/10"
                                >
                                  Delete node
                                </button>
                              ) : null}
                            </div>

                            {workflowSelectedNodeId ? (
                              (() => {
                                const node = wf.nodes.find((n) => n.id === workflowSelectedNodeId);
                                if (!node) return <div className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">No node selected.</div>;

                                return (
                                  <div className="mt-3 space-y-3">
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">id</div>
                                      <div className="mt-1 rounded-[var(--ck-radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]">
                                        {node.id}
                                      </div>
                                    </div>

                                    <label className="block">
                                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">name</div>
                                      <input
                                        value={String(node.name ?? "")}
                                        onChange={(e) => {
                                          const nextName = e.target.value;
                                          const next: WorkflowFileV1 = {
                                            ...wf,
                                            nodes: wf.nodes.map((n) => (n.id === node.id ? { ...n, name: nextName } : n)),
                                          };
                                          setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                        }}
                                        className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                        placeholder="Optional"
                                      />
                                    </label>

                                    <label className="block">
                                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">type</div>
                                      <select
                                        value={node.type}
                                        onChange={(e) => {
                                          const nextType = e.target.value as WorkflowFileV1["nodes"][number]["type"];
                                          const next: WorkflowFileV1 = {
                                            ...wf,
                                            nodes: wf.nodes.map((n) => (n.id === node.id ? { ...n, type: nextType } : n)),
                                          };
                                          setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                        }}
                                        className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                      >
                                        <option value="start">start</option>
                                        <option value="end">end</option>
                                        <option value="llm">llm</option>
                                        <option value="tool">tool</option>
                                        <option value="condition">condition</option>
                                        <option value="delay">delay</option>
                                        <option value="human_approval">human_approval</option>
                                      </select>
                                    </label>

                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="block">
                                        <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">x</div>
                                        <input
                                          type="number"
                                          value={typeof node.x === "number" ? node.x : 0}
                                          onChange={(e) => {
                                            const nextX = Number(e.target.value);
                                            const next: WorkflowFileV1 = {
                                              ...wf,
                                              nodes: wf.nodes.map((n) => (n.id === node.id ? { ...n, x: nextX } : n)),
                                            };
                                            setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                          }}
                                          className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                        />
                                      </label>
                                      <label className="block">
                                        <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">y</div>
                                        <input
                                          type="number"
                                          value={typeof node.y === "number" ? node.y : 0}
                                          onChange={(e) => {
                                            const nextY = Number(e.target.value);
                                            const next: WorkflowFileV1 = {
                                              ...wf,
                                              nodes: wf.nodes.map((n) => (n.id === node.id ? { ...n, y: nextY } : n)),
                                            };
                                            setWorkflowJsonText(JSON.stringify(next, null, 2) + "\n");
                                          }}
                                          className="mt-1 w-full rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 px-2 py-1 text-xs text-[color:var(--ck-text-primary)]"
                                        />
                                      </label>
                                    </div>

                                    <div>
                                      <div className="text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">config</div>
                                      <pre className="mt-1 max-h-[200px] overflow-auto rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-2 text-[10px] text-[color:var(--ck-text-secondary)]">
                                        {JSON.stringify(node.config ?? {}, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">Select a node.</div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">Load or create a workflow to edit triggers.</div>
                  )}
                </div>
              </div>
            ) : (
              <textarea
                value={workflowJsonText}
                onChange={(e) => setWorkflowJsonText(e.target.value)}
                className="mt-3 h-[55vh] w-full resize-none rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-3 font-mono text-xs text-[color:var(--ck-text-primary)]"
                spellCheck={false}
                placeholder="Select a workflow from the left (or create the template)."
              />
            )}
          </div>
                </div>
              </div>
            </div>
          ) : null}

        </div>
      ) : null}

{activeTab === "files" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="ck-glass-strong p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Team files</div>
              <label className="flex items-center gap-2 text-xs text-[color:var(--ck-text-secondary)]">
                <input
                  type="checkbox"
                  checked={showOptionalFiles}
                  onChange={(e) => setShowOptionalFiles(e.target.checked)}
                />
                Show optional
              </label>
            </div>
            <div className="mt-2 text-xs text-[color:var(--ck-text-tertiary)]">
              Default view hides optional missing files to reduce noise.
            </div>
            <ul className="mt-3 space-y-1">
              {teamFilesLoading ? (
                <li className="text-sm text-[color:var(--ck-text-secondary)]">Loading…</li>
              ) : null}
              {teamFiles
                .filter((f) => (showOptionalFiles ? true : f.required || !f.missing))
                .map((f) => (
                <li key={f.name}>
                  <button
                    onClick={() => onLoadTeamFile(f.name)}
                    className={
                      fileName === f.name
                        ? "w-full rounded-[var(--ck-radius-sm)] bg-white/10 px-3 py-2 text-left text-sm text-[color:var(--ck-text-primary)]"
                        : "w-full rounded-[var(--ck-radius-sm)] px-3 py-2 text-left text-sm text-[color:var(--ck-text-secondary)] hover:bg-white/5"
                    }
                  >
                    <span className={f.required ? "text-[color:var(--ck-text-primary)]" : "text-[color:var(--ck-text-secondary)]"}>
                      {f.name}
                    </span>
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[color:var(--ck-text-tertiary)]">
                      {f.required ? "required" : "optional"}
                    </span>
                    {f.missing ? <span className="ml-2 text-xs text-[color:var(--ck-text-tertiary)]">missing</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="ck-glass-strong p-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Edit: {fileName}</div>
              <button
                disabled={saving}
                onClick={onSaveTeamFile}
                className="rounded-[var(--ck-radius-sm)] bg-[var(--ck-accent-red)] px-3 py-2 text-sm font-medium text-white shadow-[var(--ck-shadow-1)] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save file"}
              </button>
            </div>

            {teamFileError ? (
              <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {teamFileError}
              </div>
            ) : null}

            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="mt-3 h-[55vh] w-full resize-none rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-3 font-mono text-xs text-[color:var(--ck-text-primary)]"
              spellCheck={false}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "orchestrator" ? <OrchestratorPanel teamId={teamId} /> : null}

      {/* markdown editor lives below for convenience */}
      {activeTab === "recipe" ? (
        <div className="mt-6 ck-glass-strong p-4">
          <div className="text-sm font-medium text-[color:var(--ck-text-primary)]">Recipe markdown</div>

          {recipeLoadError ? (
            <div className="mt-3 rounded-[var(--ck-radius-sm)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {recipeLoadError}
            </div>
          ) : null}

          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setLoadedRecipeHash(null);
            }}
            className="mt-2 h-[55vh] w-full resize-none rounded-[var(--ck-radius-sm)] border border-white/10 bg-black/25 p-3 font-mono text-xs text-[color:var(--ck-text-primary)]"
            spellCheck={false}
          />
        </div>
      ) : null}

      {/* Clone Team removed (per #0075). */}

      <PublishChangesModal
        open={publishOpen}
        teamId={teamId}
        recipeId={toId}
        busy={publishing}
        onClose={() => setPublishOpen(false)}
        onConfirm={async () => {
          setPublishing(true);
          try {
            const res = await fetch("/api/scaffold", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                kind: "team",
                recipeId: toId.trim(),
                teamId,
                overwrite: true,
                applyConfig: true,
              }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || "Publish failed");

            // Refresh team meta so we can reflect published hash/state.
            try {
              const metaRes = await fetch(`/api/teams/meta?teamId=${encodeURIComponent(teamId)}`, {
                cache: "no-store",
              });
              const metaJson = await metaRes.json();
              if (metaRes.ok && metaJson.ok && metaJson.meta && typeof metaJson.meta.recipeHash === "string") {
                setTeamMetaRecipeHash(metaJson.meta.recipeHash);
              }
            } catch {
              // ignore
            }

            setPublishOpen(false);
            flashMessage("Published changes to active team", "success");
          } catch (e: unknown) {
            flashMessage(e instanceof Error ? e.message : String(e), "error");
          } finally {
            setPublishing(false);
          }
        }}
      />

      <DeleteTeamModal
        open={deleteOpen}
        teamId={teamId}
        busy={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            const res = await fetch("/api/teams/remove-team", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ teamId }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
            flashMessage("Deleted team successfully", "success");
            setDeleteOpen(false);
            setTimeout(() => router.push("/"), 250);
          } catch (e: unknown) {
            flashMessage(e instanceof Error ? e.message : String(e), "error");
          } finally {
            setDeleting(false);
          }
        }}
      />

      {/* duplicate markdown editor removed */}
    </div>
  );
}
