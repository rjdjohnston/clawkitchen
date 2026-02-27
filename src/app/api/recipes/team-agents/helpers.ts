import YAML from "yaml";
import { NextResponse } from "next/server";
import { runOpenClaw } from "@/lib/openclaw";
import { splitRecipeFrontmatter, normalizeRole } from "@/lib/recipe-team-agents";

export { splitRecipeFrontmatter as splitFrontmatter, normalizeRole };

export function parseRecipeFrontmatter(yamlText: string) {
  const fm = (YAML.parse(yamlText) ?? {}) as Record<string, unknown>;
  const agentsRaw = fm.agents;
  const agents: Array<Record<string, unknown>> = Array.isArray(agentsRaw)
    ? (agentsRaw as Array<Record<string, unknown>>)
    : [];
  const templatesRaw = fm.templates;
  const templates: Record<string, unknown> =
    templatesRaw && typeof templatesRaw === "object" && !Array.isArray(templatesRaw)
      ? (templatesRaw as Record<string, unknown>)
      : {};
  return { fm, agents, templates };
}

export function buildNextMarkdown(
  fm: Record<string, unknown>,
  nextAgents: Array<Record<string, unknown>>,
  nextTemplates: Record<string, unknown>,
  rest: string
) {
  const nextFm = {
    ...fm,
    agents: nextAgents,
    ...(Object.keys(nextTemplates).length ? { templates: nextTemplates } : {}),
  };
  const nextYaml = YAML.stringify(nextFm).trimEnd();
  return `---\n${nextYaml}\n---\n${rest}`;
}

export type OpResult = {
  nextAgents: Array<Record<string, unknown>>;
  nextTemplates: Record<string, unknown>;
  addedRole: string | null;
};

export function handleRemove(
  agents: Array<Record<string, unknown>>,
  templates: Record<string, unknown>,
  role: string
): OpResult {
  const nextAgents = agents.filter((a) => String(a.role ?? "") !== role);
  const nextTemplates = { ...templates };
  for (const k of Object.keys(nextTemplates)) {
    if (k.startsWith(`${role}.`)) delete nextTemplates[k];
  }
  return { nextAgents, nextTemplates, addedRole: null };
}

export function handleAdd(
  agents: Array<Record<string, unknown>>,
  templates: Record<string, unknown>,
  role: string,
  name: string
): OpResult {
  const next = {
    ...agents.find((a) => String(a.role ?? "") === role),
    role,
    ...(name ? { name } : {}),
  };
  const nextAgents = agents.slice();
  const idx = nextAgents.findIndex((a) => String(a.role ?? "") === role);
  if (idx === -1) nextAgents.push(next);
  else nextAgents[idx] = next;
  return { nextAgents, nextTemplates: { ...templates }, addedRole: role };
}

function maxSuffixFromUsedRoles(usedRoles: Set<string>, baseRole: string): number {
  const escaped = baseRole.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  let n = 1;
  for (const r of usedRoles) {
    if (r === baseRole) n = Math.max(n, 1);
    const m = r.match(new RegExp(`^${escaped}-([0-9]+)$`));
    if (m) {
      const k = Number(m[1]);
      if (Number.isFinite(k)) n = Math.max(n, k);
    }
  }
  return n;
}

async function fetchExistingAgentIds(teamId: string): Promise<Set<string>> {
  if (!teamId) return new Set<string>();
  try {
    const res = await runOpenClaw(["agents", "list", "--json"]);
    if (!res.ok) return new Set<string>();
    const items = JSON.parse(res.stdout) as Array<{ id?: unknown }>;
    return new Set(items.map((a) => String(a.id ?? "").trim()).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function pickNextRole(
  baseRole: string,
  usedRoles: Set<string>,
  existingAgentIds: Set<string>,
  teamId: string,
  n: number
): string {
  const isTaken = (role: string) =>
    usedRoles.has(role) || (teamId ? existingAgentIds.has(`${teamId}-${role}`) : false);
  if (!isTaken(baseRole)) return baseRole;
  let i = Math.max(2, n + 1);
  while (isTaken(`${baseRole}-${i}`)) i++;
  return `${baseRole}-${i}`;
}

export async function handleAddLike(
  agents: Array<Record<string, unknown>>,
  templates: Record<string, unknown>,
  baseRole: string,
  name: string,
  teamId: string
): Promise<OpResult | NextResponse> {
  const base = agents.find((a) => String(a.role ?? "") === baseRole);
  if (!base) {
    return NextResponse.json({ ok: false, error: `baseRole not found in recipe: ${baseRole}` }, { status: 400 });
  }

  const nextAgents = agents.slice();
  const nextTemplates = { ...templates };
  const usedRoles = new Set(nextAgents.map((a) => String(a.role ?? "").trim()).filter(Boolean));
  const n = maxSuffixFromUsedRoles(usedRoles, baseRole);
  const existingAgentIds = await fetchExistingAgentIds(teamId);
  const nextRole = pickNextRole(baseRole, usedRoles, existingAgentIds, teamId, n);

  const baseName = typeof (base as { name?: unknown }).name === "string" ? String((base as { name?: unknown }).name) : "";
  const autoSuffix = nextRole === baseRole ? "" : String(nextRole.slice(baseRole.length + 1));
  const suffixPart = autoSuffix ? ` ${autoSuffix}` : "";
  const nextName = name || (baseName ? baseName + suffixPart : "");

  const clone = { ...base, role: nextRole, ...(nextName ? { name: nextName } : {}) };
  nextAgents.push(clone);

  for (const [k, v] of Object.entries(templates)) {
    if (!k.startsWith(`${baseRole}.`)) continue;
    const suffix = k.slice(baseRole.length);
    const nextKey = `${nextRole}${suffix}`;
    if (nextTemplates[nextKey] === undefined) nextTemplates[nextKey] = v;
  }

  const addedRole = String((nextAgents[nextAgents.length - 1] as { role?: unknown } | undefined)?.role ?? "").trim() || null;
  return { nextAgents, nextTemplates, addedRole };
}
