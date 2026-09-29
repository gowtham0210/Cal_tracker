"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "error";
  action?: { label: string; onClick: () => void };
}

type ToastFn = (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

const ToastCtx = createContext<ToastFn>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, opts) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? "success", action: opts?.action }]);
      setTimeout(() => dismiss(id), opts?.action || opts?.tone === "error" ? 5000 : 2800);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : undefined}
            className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="size-5 shrink-0 text-green-400 dark:text-green-600" />
            ) : t.tone === "error" ? (
              <AlertCircle className="size-5 shrink-0 text-red-400 dark:text-red-600" />
            ) : (
              <Info className="size-5 shrink-0 text-sky-400 dark:text-sky-600" />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className={clsx(
                  "rounded-lg px-2 py-1 font-semibold text-green-400 hover:bg-white/10 dark:text-green-700 dark:hover:bg-black/5",
                )}
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded-md p-1 opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
