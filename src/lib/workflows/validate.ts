import type { WorkflowEdgeV1, WorkflowFileV1, WorkflowNodeV1, WorkflowTriggerV1 } from "@/lib/workflows/types";

export type WorkflowValidationResult = {
  errors: string[];
  warnings: string[];
};

function isFiveFieldCron(expr: string) {
  const parts = String(expr || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length === 5;
}

function uniqCount(values: string[]) {
  const set = new Set<string>();
  for (const v of values) set.add(v);
  return set.size;
}

export function validateWorkflowFileV1(wf: WorkflowFileV1): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (wf.schema !== "clawkitchen.workflow.v1") errors.push(`schema must be clawkitchen.workflow.v1 (got ${String(wf.schema)})`);
  if (!String(wf.id || "").trim()) errors.push("id is required");
  if (!String(wf.name || "").trim()) errors.push("name is required");

  const nodes: WorkflowNodeV1[] = Array.isArray(wf.nodes) ? wf.nodes : [];
  const edges: WorkflowEdgeV1[] = Array.isArray(wf.edges) ? wf.edges : [];
  const triggers: WorkflowTriggerV1[] = Array.isArray(wf.triggers) ? wf.triggers : [];

  const nodeIds = nodes.map((n) => String(n?.id ?? "").trim()).filter(Boolean);
  if (nodeIds.length !== nodes.length) errors.push("all nodes must have a non-empty id");
  if (uniqCount(nodeIds) !== nodeIds.length) errors.push("node ids must be unique");

  const edgeIds = edges.map((e) => String(e?.id ?? "").trim()).filter(Boolean);
  if (edgeIds.length !== edges.length) errors.push("all edges must have a non-empty id");
  if (uniqCount(edgeIds) !== edgeIds.length) errors.push("edge ids must be unique");

  const nodeIdSet = new Set(nodeIds);
  for (const e of edges) {
    const from = String(e?.from ?? "").trim();
    const to = String(e?.to ?? "").trim();
    if (!from || !to) {
      errors.push(`edge ${String(e?.id ?? "(missing id)")} must have from/to`);
      continue;
    }
    if (!nodeIdSet.has(from)) errors.push(`edge ${String(e.id)} references missing from node: ${from}`);
    if (!nodeIdSet.has(to)) errors.push(`edge ${String(e.id)} references missing to node: ${to}`);
  }

  const starts = nodes.filter((n) => n.type === "start");
  const ends = nodes.filter((n) => n.type === "end");
  if (!starts.length) warnings.push("no start node found");
  if (starts.length > 1) warnings.push("multiple start nodes found (MVP supports this, but execution semantics may be ambiguous)");
  if (!ends.length) warnings.push("no end node found");

  for (const t of triggers) {
    if (t.kind === "cron") {
      if (!String(t.id || "").trim()) errors.push("cron trigger missing id");
      if (!String(t.expr || "").trim()) errors.push(`cron trigger ${String(t.id || "(missing id)")} missing expr`);
      else if (!isFiveFieldCron(t.expr)) warnings.push(`cron trigger ${String(t.id)} expr is not 5-field: ${String(t.expr)}`);
      if (t.tz && !String(t.tz).includes("/")) warnings.push(`cron trigger ${String(t.id)} tz doesn't look like an IANA timezone: ${String(t.tz)}`);
    }
  }

  return { errors, warnings };
}
