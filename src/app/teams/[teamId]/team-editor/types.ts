export type RecipeListItem = {
  id: string;
  name: string;
  kind: "agent" | "team";
  source: "builtin" | "workspace";
};

export type RecipeDetail = RecipeListItem & {
  content: string;
  filePath: string | null;
};

export type TeamFileEntry = {
  name: string;
  missing: boolean;
  required?: boolean;
  rationale?: string;
};

export type TeamAgentEntry = { id: string; identityName?: string };
