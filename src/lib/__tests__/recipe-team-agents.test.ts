import { describe, expect, it } from "vitest";
import { splitRecipeFrontmatter, normalizeRole, validateCreateId } from "../recipe-team-agents";

describe("recipe-team-agents", () => {
  describe("splitRecipeFrontmatter", () => {
    it("returns yamlText and rest", () => {
      const md = `---
kind: team
agents: []
---
# Body`;
      const { yamlText, rest } = splitRecipeFrontmatter(md);
      expect(yamlText).toContain("kind: team");
      expect(rest).toBe("# Body");
    });

    it("throws when not starting with ---", () => {
      expect(() => splitRecipeFrontmatter("no frontmatter")).toThrow(
        "Recipe markdown must start with YAML frontmatter (---)"
      );
    });

    it("throws when frontmatter not terminated", () => {
      expect(() => splitRecipeFrontmatter("---\nid: x")).toThrow(
        "Recipe frontmatter not terminated (---)"
      );
    });
  });

  describe("normalizeRole", () => {
    it("returns trimmed role", () => {
      expect(normalizeRole("  lead  ")).toBe("lead");
    });

    it("throws when empty", () => {
      expect(() => normalizeRole("")).toThrow("role is required");
    });

    it("throws when invalid format", () => {
      expect(() => normalizeRole("bad!")).toThrow("role must be alphanumeric/dash");
    });

    it("accepts valid role", () => {
      expect(normalizeRole("qa-lead")).toBe("qa-lead");
    });
  });

  describe("validateCreateId", () => {
    const recipe = { id: "my-recipe" };

    it("returns null when recipe is null", () => {
      expect(validateCreateId(null, "team-1", "team")).toBeNull();
    });

    it("returns error when id is empty", () => {
      expect(validateCreateId(recipe, "", "team")).toBe("Team id is required.");
      expect(validateCreateId(recipe, "  ", "agent")).toBe("Agent id is required.");
    });

    it("returns error when id matches recipe id", () => {
      expect(validateCreateId(recipe, "my-recipe", "team")).toContain("cannot be the same");
      expect(validateCreateId(recipe, "my-recipe", "agent")).toContain("cannot be the same");
    });

    it("returns null when valid", () => {
      expect(validateCreateId(recipe, "team-1", "team")).toBeNull();
      expect(validateCreateId(recipe, "agent-1", "agent")).toBeNull();
    });
  });
});
