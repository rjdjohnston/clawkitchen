export type ScaffoldReqBody =
  | {
      kind: "agent";
      recipeId: string;
      agentId?: string;
      name?: string;
      applyConfig?: boolean;
      overwrite?: boolean;
    }
  | {
      kind: "team";
      recipeId: string;
      teamId?: string;
      applyConfig?: boolean;
      overwrite?: boolean;
    };

export type BuildScaffoldArgsOptions = {
  allowExisting?: boolean;
};

export function buildScaffoldArgs(
  body: ScaffoldReqBody,
  options?: BuildScaffoldArgsOptions
): string[] {
  const args: string[] = ["recipes", body.kind === "team" ? "scaffold-team" : "scaffold", body.recipeId];
  if (body.overwrite) args.push("--overwrite");
  if (body.applyConfig) args.push("--apply-config");
  if (options?.allowExisting || body.overwrite) args.push("--overwrite-recipe");
  if (body.kind === "agent") {
    if (body.agentId) args.push("--agent-id", body.agentId);
    if (body.name) args.push("--name", body.name);
  } else if (body.teamId) {
    args.push("--team-id", body.teamId);
  }
  return args;
}
