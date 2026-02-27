import { describe, expect, it } from "vitest";
import { validateWorkflowFileV1 } from "../validate";

describe("lib/workflows validate", () => {
  const validWorkflow = {
    schema: "clawkitchen.workflow.v1",
    id: "test-wf",
    name: "Test workflow",
    nodes: [
      { id: "start", type: "start" as const, x: 80, y: 80 },
      { id: "end", type: "end" as const, x: 320, y: 80 },
    ],
    edges: [{ id: "e1", from: "start", to: "end" }],
  };

  it("returns no errors for valid workflow", () => {
    const r = validateWorkflowFileV1(validWorkflow);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("errors when schema wrong", () => {
    const r = validateWorkflowFileV1({ ...validWorkflow, schema: "wrong" as "clawkitchen.workflow.v1" });
    expect(r.errors.some((e) => e.includes("schema"))).toBe(true);
  });

  it("errors when id missing", () => {
    const r = validateWorkflowFileV1({ ...validWorkflow, id: "" });
    expect(r.errors.some((e) => e.includes("id is required"))).toBe(true);
  });

  it("errors when name missing", () => {
    const r = validateWorkflowFileV1({ ...validWorkflow, name: "" });
    expect(r.errors.some((e) => e.includes("name is required"))).toBe(true);
  });

  it("errors when node ids not unique", () => {
    const r = validateWorkflowFileV1({
      ...validWorkflow,
      nodes: [
        { id: "dup", type: "start" as const },
        { id: "dup", type: "end" as const },
      ],
      edges: [],
    });
    expect(r.errors.some((e) => e.includes("unique"))).toBe(true);
  });

  it("errors when edge references missing node", () => {
    const r = validateWorkflowFileV1({
      ...validWorkflow,
      edges: [{ id: "e1", from: "start", to: "nonexistent" }],
    });
    expect(r.errors.some((e) => e.includes("missing to node"))).toBe(true);
  });

  it("warns when no start node", () => {
    const r = validateWorkflowFileV1({
      ...validWorkflow,
      nodes: [{ id: "end", type: "end" as const }],
      edges: [],
    });
    expect(r.warnings.some((w) => w.includes("no start node"))).toBe(true);
  });

  it("warns when no end node", () => {
    const r = validateWorkflowFileV1({
      ...validWorkflow,
      nodes: [{ id: "start", type: "start" as const }],
      edges: [],
    });
    expect(r.warnings.some((w) => w.includes("no end node"))).toBe(true);
  });

  it("validates cron triggers", () => {
    const r = validateWorkflowFileV1({
      ...validWorkflow,
      triggers: [
        { kind: "cron" as const, id: "t1", expr: "0 9 * * 1-5", enabled: true },
      ],
    });
    expect(r.errors).toEqual([]);
  });

  it("errors when cron trigger missing expr", () => {
    const r = validateWorkflowFileV1({
      ...validWorkflow,
      triggers: [{ kind: "cron" as const, id: "t1", expr: "", enabled: true }],
    });
    expect(r.errors.some((e) => e.includes("missing expr"))).toBe(true);
  });
});
