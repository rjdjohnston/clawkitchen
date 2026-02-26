export type WorkflowRunNodeResultV1 = {
  nodeId: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  error?: { message: string; stack?: string } | string;
};

export type WorkflowRunFileV1 = {
  schema: "clawkitchen.workflow-run.v1";
  id: string;
  workflowId: string;
  teamId?: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "success" | "error" | "canceled";
  /** Optional high-level summary */
  summary?: string;
  nodes?: WorkflowRunNodeResultV1[];
  meta?: Record<string, unknown>;
};
