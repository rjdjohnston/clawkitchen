/** Client-side scaffold API. Shared by RecipeEditor and recipes-client. */

export type ScaffoldTeamBody = {
  kind: "team";
  recipeId: string;
  teamId: string;
  cronInstallChoice?: "yes" | "no";
};

export type ScaffoldAgentBody = {
  kind: "agent";
  recipeId: string;
  agentId: string;
  name?: string;
};

export async function fetchScaffold(
  body: ScaffoldTeamBody | ScaffoldAgentBody
): Promise<{ res: Response; json: unknown }> {
  const res = await fetch("/api/scaffold", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...body,
      applyConfig: true,
      overwrite: false,
    }),
  });
  const json = await res.json();
  return { res, json };
}
