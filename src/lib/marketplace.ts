import fs from "node:fs/promises";
import path from "node:path";

export type MarketplaceRecipe = {
  slug: string;
  kind: "team" | "agent";
  name: string;
  description: string;
  version: string;
  tags: string[];
  sourceUrl: string;
  homepageUrl?: string;
};

export type MarketplaceRegistry = {
  version: number;
  generatedAt: string;
  recipes: MarketplaceRecipe[];
};

const REGISTRY_PATH = path.join(process.cwd(), "marketplace", "registry.json");

export async function loadRegistry(): Promise<MarketplaceRegistry> {
  const raw = await fs.readFile(REGISTRY_PATH, "utf8");
  const data = JSON.parse(raw) as MarketplaceRegistry;
  const obj = data as unknown as { recipes?: unknown };
  if (!data || typeof data !== "object" || !Array.isArray(obj.recipes)) {
    throw new Error("Invalid marketplace registry.json");
  }
  return data;
}

export function search(recipes: MarketplaceRecipe[], q: string | null) {
  const query = (q ?? "").trim().toLowerCase();
  if (!query) return recipes;

  return recipes.filter((r) => {
    const hay = [r.slug, r.name, r.description, ...(r.tags ?? [])].join(" ").toLowerCase();
    return hay.includes(query);
  });
}

export function getBySlug(recipes: MarketplaceRecipe[], slug: string) {
  const s = slug.trim().toLowerCase();
  return recipes.find((r) => r.slug.toLowerCase() === s) ?? null;
}
