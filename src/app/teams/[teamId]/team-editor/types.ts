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

/** Setters used by loadTeamTabData and passed through from loadTeamEditorInitial. */
export type TeamTabSetters = {
  setTeamFiles: (f: TeamFileEntry[]) => void;
  setCronJobs: (j: unknown[]) => void;
  setTeamAgents: (a: TeamAgentEntry[]) => void;
  setSkillsList: (s: string[]) => void;
  setAvailableSkills: (s: string[]) => void;
  setSelectedSkill: (fn: (prev: string) => string) => void;
  setTeamFilesLoading: (v: boolean) => void;
  setCronLoading: (v: boolean) => void;
  setTeamAgentsLoading: (v: boolean) => void;
  setSkillsLoading: (v: boolean) => void;
};
