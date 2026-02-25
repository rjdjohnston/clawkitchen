"use client";

import { useEffect, useMemo } from "react";
import { slugifyId } from "@/lib/slugify";

/** Manages name -> slugified id with touch tracking. Resets on modal close. */
export function useSlugifiedId(opts: {
  open: boolean;
  name: string;
  setName: (v: string) => void;
  id: string;
  setId: (v: string) => void;
  idTouched: boolean;
  setIdTouched: (v: boolean) => void;
  slugify?: (s: string, maxLen?: number) => string;
}): { derivedId: string; effectiveId: string } {
  const { open, name, setName, id, setId, idTouched, setIdTouched, slugify = slugifyId } = opts;

  const derivedId = useMemo(() => slugify(name), [name, slugify]);
  const effectiveId = idTouched ? id : derivedId;

  useEffect(() => {
    if (!open) return;
    if (!idTouched) setId(derivedId);
  }, [derivedId, open, idTouched, setId]);

  useEffect(() => {
    if (open) return;
    setIdTouched(false);
    setName("");
    setId("");
  }, [open, setIdTouched, setName, setId]);

  return { derivedId, effectiveId };
}
