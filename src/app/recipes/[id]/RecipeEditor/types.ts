export type Recipe = {
  id: string;
  name: string;
  kind: "agent" | "team";
  source: "builtin" | "workspace";
  content: string;
  filePath: string | null;
};

export type TeamRecipeFrontmatter = {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  kind?: "team";
  source?: string;
  cronJobs?: Array<{
    id?: string;
    name?: string;
    schedule?: string;
    timezone?: string;
    agentId?: string;
    channel?: string;
    to?: string;
    description?: string;
    message?: string;
    enabledByDefault?: boolean;
  }>;
  agents?: Array<{
    role?: string;
    name?: string;
    tools?: {
      profile?: string;
      allow?: string[];
      deny?: string[];
    };
  }>;
  team?: {
    teamId?: string;
  };
  templates?: Record<string, string>;
};

export type AgentRecipeFrontmatter = {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  kind?: "agent";
  source?: string;
  templates?: Record<string, string>;
};
