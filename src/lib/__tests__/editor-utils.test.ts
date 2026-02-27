import { describe, expect, it } from "vitest";
import { normalizeFileListEntries } from "../editor-utils";

describe("editor-utils", () => {
  describe("normalizeFileListEntries", () => {
    it("normalizes file list entries", () => {
      const input = [
        { name: "TEAM.md", missing: false, required: true, rationale: "Overview" },
        { name: "X.md", missing: true, required: false },
      ];
      const result = normalizeFileListEntries(input);
      expect(result).toEqual([
        { name: "TEAM.md", missing: false, required: true, rationale: "Overview" },
        { name: "X.md", missing: true, required: false, rationale: undefined },
      ]);
    });

    it("handles empty array", () => {
      expect(normalizeFileListEntries([])).toEqual([]);
    });

    it("coerces non-string name to string", () => {
      const result = normalizeFileListEntries([{ name: 123 }]);
      expect(result[0].name).toBe("123");
    });

    it("coerces null/undefined to empty string", () => {
      const result = normalizeFileListEntries([{}]);
      expect(result[0].name).toBe("");
    });

    it("treats missing/required as boolean", () => {
      const result = normalizeFileListEntries([{ name: "x", missing: "yes", required: 1 }]);
      expect(result[0].missing).toBe(true);
      expect(result[0].required).toBe(true);
    });
  });
});
