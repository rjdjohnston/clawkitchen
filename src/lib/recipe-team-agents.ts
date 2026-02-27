export function splitRecipeFrontmatter(md: string): { yamlText: string; rest: string } {
  if (!md.startsWith("---\n")) throw new Error("Recipe markdown must start with YAML frontmatter (---)");
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("Recipe frontmatter not terminated (---)");
  const yamlText = md.slice(4, end + 1);
  const rest = md.slice(end + 5);
  return { yamlText, rest };
}

export function normalizeRole(role: string): string {
  const r = role.trim();
  if (!r) throw new Error("role is required");
  if (!/^[a-z][a-z0-9-]{0,62}$/i.test(r)) throw new Error("role must be alphanumeric/dash");
  return r;
}

/** Validates create-team or create-agent id. Returns error message or null. */
export function validateCreateId(
  recipe: { id: string } | null,
  id: string,
  entityLabel: "team" | "agent"
): string | null {
  if (!recipe) return null;
  const t = id.trim();
  const label = entityLabel === "team" ? "Team id" : "Agent id";
  if (!t) return `${label} is required.`;
  if (t === recipe.id)
    return `${label} cannot be the same as the recipe id (${recipe.id}). Choose a new ${entityLabel} id.`;
  return null;
}
