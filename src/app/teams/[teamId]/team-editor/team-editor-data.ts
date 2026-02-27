import { errorMessage } from "@/lib/errors";
import { fetchAll, fetchJson } from "@/lib/fetch-json";
import type { RecipeListItem, TeamAgentEntry, TeamTabSetters } from "./types";
import { safeParseJson } from "./team-editor-utils";

async function fetchRecipesAndMeta(teamId: string) {
  const [recipesData, metaRes] = await Promise.all([
    fetchJson<{ recipes?: RecipeListItem[] }>("/api/recipes", { cache: "no-store" }),
    fetch(`/api/teams/meta?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
  ]);
  return { recipesData, metaRes };
}

const TEAM_TAB_URLS = (teamId: string) => [
  `/api/teams/files?teamId=${encodeURIComponent(teamId)}`,
  `/api/cron/jobs?teamId=${encodeURIComponent(teamId)}`,
  "/api/agents",
  `/api/teams/skills?teamId=${encodeURIComponent(teamId)}`,
  "/api/skills/available",
];

async function fetchTeamTabResponses(teamId: string) {
  const responses = await fetchAll(TEAM_TAB_URLS(teamId));
  const texts = await Promise.all(responses.map((r) => r.text()));
  return { responses, texts };
}

export async function loadTeamTabData(teamId: string, setters: TeamTabSetters): Promise<void> {
  setters.setTeamFilesLoading(true);
  setters.setCronLoading(true);
  setters.setTeamAgentsLoading(true);
  setters.setSkillsLoading(true);
  try {
    const { responses, texts } = await fetchTeamTabResponses(teamId);
    const [filesRes, cronRes, agentsRes, skillsRes, availableSkillsRes] = responses;
    const [filesText, cronText, agentsText, skillsText, availableText] = texts;

    const filesJson = safeParseJson<{ ok?: boolean; files?: unknown[] }>(filesText, {});
    if (filesRes.ok && filesJson.ok && Array.isArray(filesJson.files)) {
      setters.setTeamFiles(
        filesJson.files.map((f) => {
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

    const cronJson = safeParseJson<{ ok?: boolean; jobs?: unknown[] }>(cronText, {});
    if (cronRes.ok && cronJson.ok && Array.isArray(cronJson.jobs)) setters.setCronJobs(cronJson.jobs);

    const agentsJson = safeParseJson<{ agents?: unknown[] }>(agentsText, {});
    if (agentsRes.ok && Array.isArray(agentsJson.agents)) {
      const filtered = agentsJson.agents.filter((a) => String((a as { id?: unknown }).id ?? "").startsWith(`${teamId}-`));
      setters.setTeamAgents(
        filtered.map((a) => {
          const agent = a as { id?: unknown; identityName?: unknown };
          return { id: String(agent.id ?? ""), identityName: typeof agent.identityName === "string" ? agent.identityName : undefined };
        }),
      );
    }

    const skillsJson = safeParseJson<{ ok?: boolean; skills?: unknown[] }>(skillsText, {});
    if (skillsRes.ok && skillsJson.ok && Array.isArray(skillsJson.skills)) setters.setSkillsList(skillsJson.skills as string[]);

    const availableJson = safeParseJson<{ ok?: boolean; skills?: unknown[] }>(availableText, {});
    if (availableSkillsRes.ok && availableJson.ok && Array.isArray(availableJson.skills)) {
      const list = availableJson.skills as string[];
      setters.setAvailableSkills(list);
      setters.setSelectedSkill((prev) => {
        const p = String(prev ?? "").trim();
        if (p && list.includes(p)) return p;
        return list[0] ?? "";
      });
    }
  } finally {
    setters.setTeamFilesLoading(false);
    setters.setCronLoading(false);
    setters.setTeamAgentsLoading(false);
    setters.setSkillsLoading(false);
  }
}

export type LoadTeamEditorInitialSetters = TeamTabSetters & {
  setRecipes: (r: RecipeListItem[]) => void;
  setLockedFromId: (v: string | null) => void;
  setLockedFromName: (v: string | null) => void;
  setProvenanceMissing: (v: boolean) => void;
  setFromId: (v: string) => void;
  setTeamMetaRecipeHash: (v: string | null) => void;
};

export async function loadTeamEditorInitial(teamId: string, setters: LoadTeamEditorInitialSetters): Promise<void> {
  const initialData = await fetchRecipesAndMeta(teamId);
  setters.setRecipes((initialData.recipesData.recipes ?? []) as RecipeListItem[]);

  let locked: { recipeId: string; recipeName?: string } | null = null;
  try {
    const metaJson = await initialData.metaRes.json();
    const meta = metaJson.meta as { recipeId?: unknown; recipeName?: unknown; recipeHash?: unknown } | undefined;
    if (initialData.metaRes.ok && metaJson.ok && meta?.recipeId) {
      locked = {
        recipeId: String(meta.recipeId),
        recipeName: typeof meta.recipeName === "string" ? meta.recipeName : undefined,
      };
      setters.setTeamMetaRecipeHash(typeof meta.recipeHash === "string" ? meta.recipeHash : null);
    } else {
      setters.setTeamMetaRecipeHash(null);
    }
  } catch {
    setters.setTeamMetaRecipeHash(null);
  }

  if (locked) {
    setters.setLockedFromId(locked.recipeId);
    setters.setLockedFromName(locked.recipeName ?? null);
    setters.setProvenanceMissing(false);
    setters.setFromId(locked.recipeId);
  } else {
    setters.setLockedFromId(null);
    setters.setLockedFromName(null);
    setters.setProvenanceMissing(true);
    const preferred = list.find((r) => r.kind === "team" && r.id === teamId);
    const fallback = list.find((r) => r.kind === "team");
    const pick = preferred ?? fallback;
    if (pick) setters.setFromId(pick.id);
  }

  await loadTeamTabData(teamId, {
    setTeamFiles: setters.setTeamFiles,
    setCronJobs: setters.setCronJobs,
    setTeamAgents: setters.setTeamAgents,
    setSkillsList: setters.setSkillsList,
    setAvailableSkills: setters.setAvailableSkills,
    setSelectedSkill: setters.setSelectedSkill,
    setTeamFilesLoading: setters.setTeamFilesLoading,
    setCronLoading: setters.setCronLoading,
    setTeamAgentsLoading: setters.setTeamAgentsLoading,
    setSkillsLoading: setters.setSkillsLoading,
  });
}

export async function fetchTeamAgentsOnce(teamId: string): Promise<{ ok: boolean; agents: TeamAgentEntry[] }> {
  try {
    const agentsJson = await fetchJson<{ agents?: unknown[] }>("/api/agents", { cache: "no-store" });
    const all = Array.isArray(agentsJson.agents) ? agentsJson.agents : [];
    const filtered = all.filter((a) => String((a as { id?: unknown }).id ?? "").startsWith(`${teamId}-`));
    const mapped = filtered.map((a) => {
      const agent = a as { id?: unknown; identityName?: unknown };
      return { id: String(agent.id ?? ""), identityName: typeof agent.identityName === "string" ? agent.identityName : undefined };
    });
    return { ok: true, agents: mapped };
  } catch {
    return { ok: false, agents: [] };
  }
}

async function applyScaffoldAfterTeamAgentsChange(
  teamId: string,
  toId: string,
  flashMessage: (msg: string, kind: "success" | "error") => void
): Promise<void> {
  try {
    await fetchJson("/api/scaffold", {
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
  } catch (e: unknown) {
    flashMessage(errorMessage(e), "error");
  }
}

async function pollTeamAgentsUntil(
  teamId: string,
  expectedAgentId: string,
  setTeamAgents: (a: TeamAgentEntry[]) => void,
  maxMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetchTeamAgentsOnce(teamId);
      if (r.ok) {
        setTeamAgents(r.agents);
        const hasExpected = expectedAgentId ? r.agents.some((a) => a.id === expectedAgentId) : false;
        if (!expectedAgentId || hasExpected) return true;
      }
    } catch {
      // ignore
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  return false;
}

export async function handleAddAgentToTeam(opts: {
  teamId: string;
  toId: string;
  newRole: string;
  derivedRole: string;
  newRoleName: string;
  content: string;
  setContent: (c: string) => void;
  setTeamAgents: (a: TeamAgentEntry[]) => void;
  flashMessage: (msg: string, kind: "success" | "error") => void;
  ensureCustomRecipeExists: (args: { overwrite: boolean }) => Promise<unknown>;
}): Promise<void> {
  const { teamId, toId, newRole, derivedRole, newRoleName, content, setContent, setTeamAgents, flashMessage, ensureCustomRecipeExists } =
    opts;
  try {
    await ensureCustomRecipeExists({ overwrite: false });
  } catch (e: unknown) {
    const msg = errorMessage(e);
    if (!/Recipe id already exists:/i.test(msg)) throw e;
  }
  const json = await fetchJson<{ ok?: boolean; content?: string; addedAgentId?: string }>("/api/recipes/team-agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      newRole === "__custom__"
        ? { recipeId: toId.trim(), op: "add", role: derivedRole, name: newRoleName }
        : { recipeId: toId.trim(), op: "addLike", baseRole: derivedRole, teamId, name: newRoleName },
    ),
  });
  if (!json.ok) throw new Error("Failed updating agents list");
  setContent(String(json.content ?? content));

  await applyScaffoldAfterTeamAgentsChange(teamId, toId, flashMessage);

  const expectedAgentId = typeof json.addedAgentId === "string" ? json.addedAgentId : "";
  const appeared = await pollTeamAgentsUntil(teamId, expectedAgentId, setTeamAgents, 5000);
  if (!appeared && expectedAgentId) {
    try {
      void fetch("/api/gateway/restart", { method: "POST" });
    } catch {
      // ignore
    }
    await pollTeamAgentsUntil(teamId, expectedAgentId, setTeamAgents, 10000);
  }
  flashMessage(`Updated agents list in ${toId}`, "success");
}
