"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; message: string; kind: ToastKind };
type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, kind }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-[min(24rem,calc(100vw-3rem))]"
      >
        {toasts.map((item) => (
          <Toast
            dismiss={dismiss}
            id={item.id}
            key={item.id}
            toast={item}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({
  toast,
  id,
  dismiss,
}: {
  toast: ToastItem;
  id: number;
  dismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(id), 5000);
    return () => window.clearTimeout(timer);
  }, [dismiss, id]);

  const Icon = toast.kind === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-foreground shadow-xl"
      role={toast.kind === "error" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={
          toast.kind === "success"
            ? "mt-0.5 size-5 shrink-0 text-success"
            : "mt-0.5 size-5 shrink-0 text-destructive"
        }
      />
      <p className="flex-1 text-sm leading-5">{toast.message}</p>
      <button
        aria-label="Dismiss notification"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => dismiss(id)}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a FeedbackProvider.");
  }
  return context.toast;
}
