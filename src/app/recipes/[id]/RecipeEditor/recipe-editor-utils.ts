import { parse as parseYaml } from "yaml";
import { errorMessage } from "@/lib/errors";
import type { AgentRecipeFrontmatter, TeamRecipeFrontmatter } from "./types";

export function parseFrontmatter(raw: string): { fm: TeamRecipeFrontmatter | AgentRecipeFrontmatter | null; error?: string } {
  const start = raw.indexOf("---\n");
  if (start !== 0) return { fm: null };
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return { fm: null };
  const yamlText = raw.slice(4, end);

  try {
    const fm = parseYaml(yamlText) as TeamRecipeFrontmatter | AgentRecipeFrontmatter;
    if (!fm || typeof fm !== "object") return { fm: null };
    return { fm };
  } catch (e) {
    return { fm: null, error: errorMessage(e) };
  }
}

export function templateKeyToFileName(key: string, stripRolePrefix?: boolean): string {
  const suffix = stripRolePrefix ? key.split(".").slice(1).join(".") : key;
  switch (suffix) {
    case "soul":
      return "SOUL.md";
    case "agents":
      return "AGENTS.md";
    case "tools":
      return "TOOLS.md";
    case "identity":
      return "IDENTITY.md";
    case "install":
      return "INSTALL.md";
    case "status":
      return "STATUS.md";
    default:
      return suffix ? `${suffix.toUpperCase()}` : key;
  }
}

export function expectedFilesForRole(fm: TeamRecipeFrontmatter | null, role: string | undefined): string[] {
  if (!fm || !role || !fm.templates) return [];
  const keys = Object.keys(fm.templates).filter((k) => k.startsWith(`${role}.`));
  const files = keys.map((k) => templateKeyToFileName(k, true));
  return [...new Set(files)];
}
