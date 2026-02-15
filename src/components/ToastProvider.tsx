"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  timeoutMs?: number;
};

type ToastContextValue = {
  push: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-400">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-400">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm0-8a1 1 0 012 0v6a1 1 0 11-2 0V5z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-300">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 112 0v5a1 1 0 11-2 0V9zm0-3a1 1 0 112 0 1 1 0 01-2 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast: Toast = { id, timeoutMs: 5000, ...t };
      setToasts((prev) => [toast, ...prev].slice(0, 4));
      const ms = toast.timeoutMs;
      if (ms && ms > 0) {
        window.setTimeout(() => remove(id), ms);
      }
    },
    [remove],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Tailwind UI-inspired notifications */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-[100] flex items-end px-4 py-6 sm:p-6"
      >
        <div className="flex w-full flex-col items-start space-y-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border border-white/10 bg-[color:var(--ck-bg-glass-strong)] shadow-[var(--ck-shadow-2)]"
            >
              <div className="p-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <ToastIcon kind={t.kind} />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    {t.title ? (
                      <p className="text-sm font-medium text-[color:var(--ck-text-primary)]">{t.title}</p>
                    ) : null}
                    <p className="text-sm text-[color:var(--ck-text-secondary)] whitespace-pre-wrap">{t.message}</p>
                  </div>
                  <div className="ml-4 flex shrink-0">
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="inline-flex rounded-md bg-transparent text-[color:var(--ck-text-tertiary)] hover:text-[color:var(--ck-text-primary)]"
                      aria-label="Dismiss"
                      title="Dismiss"
                    >
                      <span className="sr-only">Close</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
