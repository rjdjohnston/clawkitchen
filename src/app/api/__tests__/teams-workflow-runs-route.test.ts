import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "../teams/workflow-runs/route";

vi.mock("@/lib/workflows/runs-storage", () => ({
  listWorkflowRuns: vi.fn(),
  readWorkflowRun: vi.fn(),
  writeWorkflowRun: vi.fn(),
}));
vi.mock("@/lib/workflows/storage", () => ({
  readWorkflow: vi.fn(),
}));

import { listWorkflowRuns, readWorkflowRun } from "@/lib/workflows/runs-storage";

describe("api teams workflow-runs route", () => {
  beforeEach(() => {
    vi.mocked(listWorkflowRuns).mockReset();
    vi.mocked(readWorkflowRun).mockReset();
  });

  it("GET returns 400 when teamId missing", async () => {
    const res = await GET(new Request("https://test"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("teamId is required");
  });

  it("GET returns 400 when workflowId missing", async () => {
    const res = await GET(new Request("https://test?teamId=team1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("workflowId is required");
  });

  it("GET returns 200 with list when no runId", async () => {
    vi.mocked(listWorkflowRuns).mockResolvedValue({
      ok: true,
      dir: "/home/test",
      files: ["run-1.run.json"],
    });
    const res = await GET(new Request("https://test?teamId=team1&workflowId=wf1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.files).toEqual(["run-1.run.json"]);
  });

  it("GET returns 200 with run when runId provided", async () => {
    const run = { id: "run-1", status: "running", nodes: [] };
    vi.mocked(readWorkflowRun).mockResolvedValue({
      ok: true,
      path: "/home/test/run-1.run.json",
      run,
    });
    const res = await GET(new Request("https://test?teamId=team1&workflowId=wf1&runId=run-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.run).toEqual(run);
  });

  it("POST returns 400 when teamId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ workflowId: "wf1", mode: "create" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("teamId is required");
  });

  it("POST returns 400 when workflowId missing", async () => {
    const res = await POST(
      new Request("https://test", {
        method: "POST",
        body: JSON.stringify({ teamId: "team1", mode: "create" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("workflowId is required");
  });
});
