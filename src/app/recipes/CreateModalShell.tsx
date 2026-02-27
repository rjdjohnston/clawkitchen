"use client";

import { ConfirmationModal } from "@/components/ConfirmationModal";

export function CreateModalShell({
  open,
  title,
  recipeId,
  recipeName,
  children,
  error,
  busy,
  canConfirm,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  open: boolean;
  title: string;
  recipeId: string;
  recipeName: string;
  children: React.ReactNode;
  error?: string | null;
  busy?: boolean;
  canConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <ConfirmationModal
      open={open}
      onClose={onClose}
      title={title}
      error={error}
      confirmLabel={confirmLabel}
      confirmBusyLabel="Creating…"
      confirmDisabled={!canConfirm}
      busy={busy}
      onConfirm={onConfirm}
    >
      <p className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">
        Create a new {title.toLowerCase().replace("create ", "")} from recipe{" "}
        <code className="font-mono">{recipeId}</code>
        {recipeName ? (
          <>
            {" "}(<span className="font-medium">{recipeName}</span>)
          </>
        ) : null}
        .
      </p>
      {children}
    </ConfirmationModal>
  );
}
