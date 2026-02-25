import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseRecipeFrontmatter,
  buildNextMarkdown,
  handleRemove,
  handleAdd,
  handleAddLike,
} from "../helpers";

vi.mock("@/lib/openclaw", () => ({
  runOpenClaw: vi.fn(),
}));

import { runOpenClaw } from "@/lib/openclaw";

describe("recipes team-agents helpers", () => {
  describe("parseRecipeFrontmatter", () => {
    it("parses valid YAML with agents and templates", () => {
      const yaml = `
kind: team
agents:
  - role: lead
    name: Lead
templates:
  lead.prompt: "# Prompt"
`;
      const { fm, agents, templates } = parseRecipeFrontmatter(yaml);
      expect(fm.kind).toBe("team");
      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual({ role: "lead", name: "Lead" });
      expect(templates).toEqual({ "lead.prompt": "# Prompt" });
    });

    it("handles empty YAML", () => {
      const { fm, agents, templates } = parseRecipeFrontmatter("");
      expect(fm).toEqual({});
      expect(agents).toEqual([]);
      expect(templates).toEqual({});
    });

    it("handles non-array agents", () => {
      const { agents } = parseRecipeFrontmatter("agents: not-an-array");
      expect(agents).toEqual([]);
    });

    it("handles non-object templates", () => {
      const { templates } = parseRecipeFrontmatter("templates: []");
      expect(templates).toEqual({});
    });
  });

  describe("buildNextMarkdown", () => {
    it("builds markdown with updated agents and templates", () => {
      const fm = { kind: "team" };
      const nextAgents = [{ role: "lead", name: "Lead" }];
      const nextTemplates = { "lead.prompt": "content" };
      const rest = "# Body";
      const result = buildNextMarkdown(fm, nextAgents, nextTemplates, rest);
      expect(result).toContain("---");
      expect(result).toContain("kind: team");
      expect(result).toContain("role: lead");
      expect(result).toContain("# Body");
    });

    it("omits templates when empty", () => {
      const fm = { kind: "team" };
      const nextAgents: Array<Record<string, unknown>> = [];
      const nextTemplates: Record<string, unknown> = {};
      const result = buildNextMarkdown(fm, nextAgents, nextTemplates, "body");
      expect(result).not.toContain("templates:");
    });
  });

  describe("handleRemove", () => {
    it("removes agent and role-prefixed templates", () => {
      const agents = [
        { role: "lead", name: "Lead" },
        { role: "qa", name: "QA" },
      ];
      const templates = {
        "lead.prompt": "x",
        "qa.prompt": "y",
        "other.stuff": "z",
      };
      const result = handleRemove(agents, templates, "lead");
      expect(result.nextAgents).toHaveLength(1);
      expect(result.nextAgents[0].role).toBe("qa");
      expect(result.nextTemplates).toEqual({ "qa.prompt": "y", "other.stuff": "z" });
      expect(result.addedRole).toBeNull();
    });

    it("returns addedRole null", () => {
      const result = handleRemove([{ role: "x" }], {}, "x");
      expect(result.addedRole).toBeNull();
    });
  });

  describe("handleAdd", () => {
    it("adds new agent when role not present", () => {
      const agents: Array<Record<string, unknown>> = [];
      const templates = {};
      const result = handleAdd(agents, templates, "qa", "QA Lead");
      expect(result.nextAgents).toHaveLength(1);
      expect(result.nextAgents[0]).toEqual({ role: "qa", name: "QA Lead" });
      expect(result.addedRole).toBe("qa");
    });

    it("updates existing agent when role present", () => {
      const agents = [{ role: "qa", name: "Old" }];
      const templates = {};
      const result = handleAdd(agents, templates, "qa", "New Name");
      expect(result.nextAgents).toHaveLength(1);
      expect(result.nextAgents[0]).toEqual({ role: "qa", name: "New Name" });
      expect(result.addedRole).toBe("qa");
    });

    it("copies templates without mutating", () => {
      const agents: Array<Record<string, unknown>> = [];
      const templates = { x: "y" };
      const result = handleAdd(agents, templates, "qa", "");
      expect(result.nextTemplates).toEqual({ x: "y" });
    });
  });

  describe("handleAddLike", () => {
    beforeEach(() => {
      vi.mocked(runOpenClaw).mockResolvedValue({
        ok: true,
        stdout: JSON.stringify([{ id: "team1-lead" }]),
        stderr: "",
        exitCode: 0,
      });
    });

    it("returns 400 when baseRole not found", async () => {
      const agents: Array<Record<string, unknown>> = [];
      const result = await handleAddLike(agents, {}, "lead", "New", "team1");
      expect(result).toBeInstanceOf(Response);
      const res = result as Response;
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("baseRole not found");
    });

    it("adds clone with suffixed role when base exists", async () => {
      const agents = [{ role: "lead", name: "Lead" }];
      const templates = { "lead.prompt": "content" };
      const result = await handleAddLike(agents, templates, "lead", "Lead 2", "team1");
      expect(result).not.toBeInstanceOf(Response);
      const op = result as { nextAgents: Array<Record<string, unknown>>; nextTemplates: Record<string, unknown>; addedRole: string | null };
      expect(op.nextAgents).toHaveLength(2);
      expect(op.nextAgents[1].role).toMatch(/^lead(-\d+)?$/);
      expect(op.addedRole).toBeTruthy();
    });
  });
});
