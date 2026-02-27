import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  workflowFileName,
  assertSafeWorkflowId,
  listWorkflows,
  readWorkflow,
  writeWorkflow,
  deleteWorkflow,
} from "../storage";

vi.mock("@/lib/paths", () => ({
  getTeamWorkspaceDir: vi.fn().mockResolvedValue("/home/test/workspace/team1"),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
  },
}));

import fs from "node:fs/promises";

describe("lib/workflows storage", () => {
  beforeEach(() => {
    vi.mocked(fs.readdir).mockReset();
    vi.mocked(fs.readFile).mockReset();
    vi.mocked(fs.writeFile).mockReset();
    vi.mocked(fs.mkdir).mockReset();
    vi.mocked(fs.unlink).mockReset();
  });

  describe("workflowFileName", () => {
    it("returns id.workflow.json", () => {
      expect(workflowFileName("my-workflow")).toBe("my-workflow.workflow.json");
    });
  });

  describe("assertSafeWorkflowId", () => {
    it("returns trimmed id when valid", () => {
      expect(assertSafeWorkflowId("  abc-123  ")).toBe("abc-123");
    });

    it("throws when empty", () => {
      expect(() => assertSafeWorkflowId("")).toThrow(/workflow id is required/i);
      expect(() => assertSafeWorkflowId("   ")).toThrow(/workflow id is required/i);
    });

    it("throws when invalid chars", () => {
      expect(() => assertSafeWorkflowId("UPPERCASE")).toThrow(/Invalid workflow id/i);
      expect(() => assertSafeWorkflowId("has_underscore")).toThrow(/Invalid workflow id/i);
      expect(() => assertSafeWorkflowId("has space")).toThrow(/Invalid workflow id/i);
    });

    it("accepts valid ids", () => {
      expect(assertSafeWorkflowId("a")).toBe("a");
      expect(assertSafeWorkflowId("abc-123")).toBe("abc-123");
      expect(assertSafeWorkflowId("a1b2c3")).toBe("a1b2c3");
    });
  });

  describe("listWorkflows", () => {
    it("returns empty list when dir does not exist", async () => {
      vi.mocked(fs.readdir).mockRejectedValue({ code: "ENOENT" });
      const r = await listWorkflows("team1");
      expect(r.ok).toBe(true);
      expect(r.files).toEqual([]);
    });

    it("returns sorted workflow files", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "b.workflow.json", isFile: () => true },
        { name: "a.workflow.json", isFile: () => true },
        { name: "other.txt", isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      const r = await listWorkflows("team1");
      expect(r.ok).toBe(true);
      expect(r.files).toEqual(["a.workflow.json", "b.workflow.json"]);
    });
  });

  describe("readWorkflow", () => {
    it("returns parsed workflow", async () => {
      const wf = { schema: "clawkitchen.workflow.v1", id: "wf1", name: "Test", nodes: [], edges: [] };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(wf));
      const r = await readWorkflow("team1", "wf1");
      expect(r.ok).toBe(true);
      expect(r.workflow).toEqual(wf);
    });

    it("throws when id invalid", async () => {
      await expect(readWorkflow("team1", "")).rejects.toThrow(/workflow id is required/i);
    });
  });

  describe("writeWorkflow", () => {
    it("writes workflow with schema", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      const wf = { schema: "clawkitchen.workflow.v1", id: "wf1", name: "Test", nodes: [], edges: [] };
      const r = await writeWorkflow("team1", wf);
      expect(r.ok).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("wf1.workflow.json"),
        expect.stringContaining('"schema": "clawkitchen.workflow.v1"'),
        "utf8"
      );
    });
  });

  describe("deleteWorkflow", () => {
    it("returns existed:true when file deleted", async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      const r = await deleteWorkflow("team1", "wf1");
      expect(r.ok).toBe(true);
      expect((r as { existed?: boolean }).existed).toBe(true);
    });

    it("returns existed:false when file not found", async () => {
      vi.mocked(fs.unlink).mockRejectedValue({ code: "ENOENT" });
      const r = await deleteWorkflow("team1", "wf1");
      expect(r.ok).toBe(true);
      expect((r as { existed?: boolean }).existed).toBe(false);
    });
  });
});
