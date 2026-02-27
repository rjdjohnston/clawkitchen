"use client";

import { ConfirmationModal } from "./ConfirmationModal";

/** Shared delete confirmation modal: title, entity label in code, body text. */
export function DeleteEntityModal({
  open,
  onClose,
  title,
  entityLabel,
  bodyText,
  onConfirm,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  entityLabel: string;
  bodyText: string;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <ConfirmationModal
      open={open}
      onClose={onClose}
      title={title}
      confirmLabel="Delete"
      confirmBusyLabel="Deleting…"
      onConfirm={onConfirm}
      busy={busy}
      error={error ?? undefined}
    >
      <p className="mt-2 text-sm text-[color:var(--ck-text-secondary)]">
        {title} <code className="font-mono">{entityLabel}</code>? {bodyText}
      </p>
    </ConfirmationModal>
  );
}
