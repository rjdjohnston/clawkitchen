import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "../teams/workflows/route";

vi.mock("@/lib/workflows/storage", () => ({
  listWorkflows: vi.fn(),
  readWorkflow: vi.fn(),
  writeWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

import { listWorkflows, readWorkflow, writeWorkflow, deleteWorkflow } from "@/lib/workflows/storage";

describe("api teams workflows route", () => {
  beforeEach(() => {
    vi.mocked(listWorkflows).mockReset();
    vi.mocked(readWorkflow).mockReset();
    vi.mocked(writeWorkflow).mockReset();
    vi.mocked(deleteWorkflow).mockReset();
  });

  it("GET returns 400 when teamId missing", async () => {
    const res = await GET(new Request("https://test"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("teamId is required");
  });

  it("GET returns 200 with list when no id", async () => {
    vi.mocked(listWorkflows).mockResolvedValue({ ok: true, dir: "/tmp", files: ["a.workflow.json"] });
    const res = await GET(new Request("https://test?teamId=team1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.files).toEqual(["a.workflow.json"]);
    expect(listWorkflows).toHaveBeenCalledWith("team1");
  });

  it("GET returns 200 with workflow when id provided", async () => {
    const wf = { id: "wf1", name: "Test", nodes: [], edges: [] };
    vi.mocked(readWorkflow).mockResolvedValue({ ok: true, path: "/home/test/wf1.workflow.json", workflow: wf });
    const res = await GET(new Request("https://test?teamId=team1&id=wf1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.workflow).toEqual(wf);
    expect(readWorkflow).toHaveBeenCalledWith("team1", "wf1");
  });

  it("POST returns 400 when teamId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ workflow: { id: "wf1", name: "Test", nodes: [], edges: [] } }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("teamId is required");
  });

  it("POST returns 400 when workflow invalid", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ teamId: "team1", workflow: {} }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/workflow.*required/i);
  });

  it("POST returns 200 when workflow valid", async () => {
    const wf = { id: "wf1", name: "Test", nodes: [], edges: [] };
    vi.mocked(writeWorkflow).mockResolvedValue({ ok: true, path: "/home/test/wf1.workflow.json" });
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ teamId: "team1", workflow: wf }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(writeWorkflow).toHaveBeenCalledWith("team1", expect.objectContaining({ id: "wf1", name: "Test" }));
  });

  it("DELETE returns 400 when teamId missing", async () => {
    const res = await DELETE(new Request("https://test"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("teamId is required");
  });

  it("DELETE returns 400 when id missing", async () => {
    const res = await DELETE(new Request("https://test?teamId=team1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id is required");
  });

  it("DELETE returns 200 when valid", async () => {
    vi.mocked(deleteWorkflow).mockResolvedValue({ ok: true, path: "/home/test/wf1.workflow.json", existed: true });
    const res = await DELETE(new Request("https://test?teamId=team1&id=wf1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(deleteWorkflow).toHaveBeenCalledWith("team1", "wf1");
  });
});
