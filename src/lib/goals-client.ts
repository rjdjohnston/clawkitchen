"use client";

import { useMemo, useState } from "react";

/** Client-safe goal types and utils (no node deps). */

export type GoalStatus = "planned" | "active" | "done";

export type GoalFrontmatter = {
  id: string;
  title: string;
  status: GoalStatus;
  tags: string[];
  teams: string[];
  updatedAt: string;
};

/** Form state shape for GoalFormFields. */
export type GoalFormState = {
  title: string;
  setTitle: (v: string) => void;
  status: GoalStatus;
  setStatus: (v: GoalStatus) => void;
  tagsRaw: string;
  setTagsRaw: (v: string) => void;
  teamsRaw: string;
  setTeamsRaw: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
};

/** Parses comma-separated string into trimmed non-empty array. */
export function parseCommaList(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Shared form state for goal create/edit. Returns formState for GoalFormFields and parsed tags/teams. */
export function useGoalFormState(initial?: Partial<GoalFormState>): {
  formState: GoalFormState;
  tags: string[];
  teams: string[];
} {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<GoalStatus>(initial?.status ?? "planned");
  const [tagsRaw, setTagsRaw] = useState(initial?.tagsRaw ?? "");
  const [teamsRaw, setTeamsRaw] = useState(initial?.teamsRaw ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  const formState: GoalFormState = useMemo(
    () => ({
      title,
      setTitle,
      status,
      setStatus,
      tagsRaw,
      setTagsRaw,
      teamsRaw,
      setTeamsRaw,
      body,
      setBody,
    }),
    [title, status, tagsRaw, teamsRaw, body]
  );

  const tags = useMemo(() => parseCommaList(tagsRaw), [tagsRaw]);
  const teams = useMemo(() => parseCommaList(teamsRaw), [teamsRaw]);

  return { formState, tags, teams };
}
