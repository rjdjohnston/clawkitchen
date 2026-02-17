import { runOpenClaw } from "@/lib/openclaw";
import HomeClient from "./HomeClient";

type AgentListItem = {
  id: string;
  identityName?: string;
  workspace?: string;
  model?: string;
  isDefault?: boolean;
};

type RecipeListItem = {
  id: string;
  name: string;
  kind: "agent" | "team";
  source: "builtin" | "workspace";
};

async function getAgents(): Promise<AgentListItem[]> {
  const res = await runOpenClaw(["agents", "list", "--json"]);
  if (!res.ok) return [];
  return JSON.parse(res.stdout) as AgentListItem[];
}

async function getTeamsFromRecipes(): Promise<{ teamNames: Record<string, string> }> {
  const res = await runOpenClaw(["recipes", "list"]);
  if (!res.ok) return { teamNames: {} };

  let items: RecipeListItem[] = [];
  try {
    items = JSON.parse(res.stdout) as RecipeListItem[];
  } catch {
    return { teamNames: {} };
  }

  const teamNames: Record<string, string> = {};

  for (const r of items) {
    if (r.kind !== "team") continue;
    const name = String(r.name ?? "").trim();
    if (!name) continue;

    teamNames[r.id] = name;

  }

  return { teamNames };
}

export default async function Home() {
  const [agents, { teamNames }] = await Promise.all([getAgents(), getTeamsFromRecipes()]);
  return <HomeClient agents={agents} teamNames={teamNames} />;
}
