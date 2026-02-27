import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchScaffold } from "../scaffold-client";

const mockFetch = vi.hoisted(() => vi.fn());

describe("scaffold-client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  describe("fetchScaffold", () => {
    it("sends team scaffold request with correct body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { res, json } = await fetchScaffold({
        kind: "team",
        recipeId: "my-recipe",
        teamId: "my-team",
        cronInstallChoice: "yes",
      });

      expect(res.ok).toBe(true);
      expect(json).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith("/api/scaffold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "team",
          recipeId: "my-recipe",
          teamId: "my-team",
          cronInstallChoice: "yes",
          applyConfig: true,
          overwrite: false,
        }),
      });
    });

    it("sends agent scaffold request with correct body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, stderr: "" }),
      });

      const { res, json } = await fetchScaffold({
        kind: "agent",
        recipeId: "template",
        agentId: "my-agent",
        name: "My Agent",
      });

      expect(res.ok).toBe(true);
      expect(json).toEqual({ ok: true, stderr: "" });
      expect(mockFetch).toHaveBeenCalledWith("/api/scaffold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "agent",
          recipeId: "template",
          agentId: "my-agent",
          name: "My Agent",
          applyConfig: true,
          overwrite: false,
        }),
      });
    });

    it("always adds applyConfig and overwrite to body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await fetchScaffold({
        kind: "agent",
        recipeId: "r",
        agentId: "a",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.applyConfig).toBe(true);
      expect(body.overwrite).toBe(false);
    });

    it("returns res and parsed json on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ ok: false, error: "Scaffold failed" }),
      });

      const { res, json } = await fetchScaffold({
        kind: "team",
        recipeId: "r",
        teamId: "t",
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
      expect(json).toEqual({ ok: false, error: "Scaffold failed" });
    });
  });
});
