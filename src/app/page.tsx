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

async function getTeamsFromRecipes(): Promise<{ teamNames: Record<string, string>; customTeams: Array<{ teamId: string; name: string; recipeId: string }> }> {
  const res = await runOpenClaw(["recipes", "list"]);
  if (!res.ok) return { teamNames: {}, customTeams: [] };

  let items: RecipeListItem[] = [];
  try {
    items = JSON.parse(res.stdout) as RecipeListItem[];
  } catch {
    return { teamNames: {}, customTeams: [] };
  }

  const teamNames: Record<string, string> = {};
  const customTeams: Array<{ teamId: string; name: string; recipeId: string }> = [];

  for (const r of items) {
    if (r.kind !== "team") continue;
    const name = String(r.name ?? "").trim();
    if (!name) continue;

    teamNames[r.id] = name;

    // Custom teams: workspace team recipes that start with custom-.
    if (r.source === "workspace" && r.id.startsWith("custom-")) {
      const teamId = r.id.slice("custom-".length);
      customTeams.push({ teamId, name, recipeId: r.id });
    }
  }

  customTeams.sort((a, b) => a.teamId.localeCompare(b.teamId));

  return { teamNames, customTeams };
}

export default async function Home() {
  const [agents, { teamNames, customTeams }] = await Promise.all([getAgents(), getTeamsFromRecipes()]);
  return <HomeClient agents={agents} teamNames={teamNames} customTeams={customTeams} />;
}
