"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

export type ToastVariant = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastItem = Required<Pick<ToastInput, "title" | "variant">> &
  Pick<ToastInput, "description"> & { id: string };

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: "border-success/30",
  error: "border-danger/30",
  info: "border-brand/30",
};

const variantIcons: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const variantIconColor: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-brand",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [
      ...current,
      {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info",
      },
    ]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
        {children}
        {toasts.map((item) => {
          const Icon = variantIcons[item.variant];
          return (
            <ToastPrimitive.Root
              key={item.id}
              onOpenChange={(open) => {
                if (!open) dismiss(item.id);
              }}
              className={cn(
                "flex gap-4 rounded-card border bg-surface-raised p-4 shadow-[0_8px_24px_rgb(11_31_51_/_0.12)]",
                "data-[state=open]:animate-[dw-fade-in_180ms_ease-out]",
                variantStyles[item.variant],
              )}
            >
              <Icon
                aria-hidden
                className={cn("size-6 shrink-0", variantIconColor[item.variant])}
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="font-sans text-sm font-semibold text-ink">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="mt-1 text-sm leading-relaxed text-slate">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              <ToastPrimitive.Close
                className={cn(
                  "rounded-control p-2 text-slate transition-colors duration-hover ease-out hover:text-ink",
                  focusRing,
                )}
                aria-label="Dismiss notification"
              >
                <X className="size-4" strokeWidth={1.75} />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-50 m-0 flex w-96 max-w-[calc(100vw-32px)] list-none flex-col gap-4 p-4 outline-none sm:p-8" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
