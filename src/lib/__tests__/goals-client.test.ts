import { describe, expect, it } from "vitest";
import { parseCommaList } from "../goals-client";

describe("goals-client", () => {
  describe("parseCommaList", () => {
    it("parses comma-separated string into trimmed array", () => {
      expect(parseCommaList("a, b, c")).toEqual(["a", "b", "c"]);
    });

    it("filters empty strings", () => {
      expect(parseCommaList("a,,b,  ,c")).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for empty string", () => {
      expect(parseCommaList("")).toEqual([]);
    });

    it("trims whitespace", () => {
      expect(parseCommaList("  x  ,  y  ")).toEqual(["x", "y"]);
    });

    it("handles single item", () => {
      expect(parseCommaList("only")).toEqual(["only"]);
    });
  });
});
