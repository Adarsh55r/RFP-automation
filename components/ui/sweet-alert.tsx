"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The app's one alert: a centred card with an animated icon, used for results
 * of actions (saved, failed, needs attention) and for confirmations. Success
 * closes itself; everything else waits for the user. Alerts queue, so two
 * at once are shown one after the other.
 */

export type AlertTone = "success" | "error" | "warning" | "info";

type AlertRequest = {
  id: number;
  tone: AlertTone;
  title: string;
  text?: string;
  /** Present for confirmations: the answer is resolved when the card closes. */
  confirm?: { confirmLabel: string; cancelLabel: string; destructive: boolean; resolve: (ok: boolean) => void };
};

type AlertOptions = { title: string; text?: string };
type ConfirmOptions = AlertOptions & { tone?: AlertTone; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };

type AlertApi = {
  success: (title: string, text?: string) => void;
  error: (title: string, text?: string) => void;
  warning: (title: string, text?: string) => void;
  info: (title: string, text?: string) => void;
  /** Resolves true when the user confirms, false when they cancel or close the card. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const AlertContext = createContext<AlertApi | null>(null);

const AUTO_CLOSE_MS = 2400;

const toneStyle: Record<AlertTone, { ring: string; fill: string; stroke: string; glow: string }> = {
  success: { ring: "ring-success/20", fill: "bg-success/10", stroke: "var(--success)", glow: "color-mix(in srgb, var(--success) 30%, transparent)" },
  error: { ring: "ring-danger/20", fill: "bg-danger/10", stroke: "var(--danger)", glow: "color-mix(in srgb, var(--danger) 30%, transparent)" },
  warning: { ring: "ring-accent/30", fill: "bg-accent/15", stroke: "var(--accent)", glow: "color-mix(in srgb, var(--accent) 34%, transparent)" },
  info: { ring: "ring-brand/20", fill: "bg-brand/10", stroke: "var(--brand)", glow: "rgb(var(--glow) / 0.3)" },
};

/** The tone's symbol, drawn stroke by stroke. */
function AlertIcon({ tone }: { tone: AlertTone }) {
  const reduceMotion = useReducedMotion();
  const style = toneStyle[tone];
  const draw = (delay: number) => ({
    initial: { pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: reduceMotion ? 0 : 0.42, delay: reduceMotion ? 0 : delay, ease: "easeOut" as const },
  });
  const common = { fill: "none", stroke: style.stroke, strokeWidth: 3.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <motion.div
      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className={`relative mx-auto flex size-20 items-center justify-center rounded-full ring-8 ${style.ring} ${style.fill}`}
      style={{ boxShadow: `0 12px 36px ${style.glow}` }}
      aria-hidden
    >
      <svg viewBox="0 0 52 52" className="size-11">
        <motion.circle cx="26" cy="26" r="23" {...common} strokeWidth={2.4} {...draw(0)} />
        {tone === "success" ? <motion.path d="M15 27.5 L22.5 34.5 L37.5 18.5" {...common} {...draw(0.3)} /> : null}
        {tone === "error" ? (
          <>
            <motion.path d="M18 18 L34 34" {...common} {...draw(0.3)} />
            <motion.path d="M34 18 L18 34" {...common} {...draw(0.45)} />
          </>
        ) : null}
        {tone === "warning" ? (
          <>
            <motion.path d="M26 14 L26 30" {...common} {...draw(0.3)} />
            <motion.path d="M26 37.5 L26 38" {...common} strokeWidth={4.4} {...draw(0.5)} />
          </>
        ) : null}
        {tone === "info" ? (
          <>
            <motion.path d="M26 14.5 L26 15" {...common} strokeWidth={4.4} {...draw(0.3)} />
            <motion.path d="M26 22 L26 38" {...common} {...draw(0.4)} />
          </>
        ) : null}
      </svg>
    </motion.div>
  );
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const nextId = useRef(1);
  const current = queue[0] ?? null;
  const reduceMotion = useReducedMotion();

  const push = useCallback((request: Omit<AlertRequest, "id">) => {
    const id = nextId.current++;
    setQueue((items) => [...items, { ...request, id }]);
  }, []);

  const close = useCallback((answer: boolean) => {
    setQueue((items) => {
      items[0]?.confirm?.resolve(answer);
      return items.slice(1);
    });
  }, []);

  // Short success messages close themselves once read; longer ones wait to be read.
  const autoClose = Boolean(current && !current.confirm && current.tone === "success" && (current.text ?? "").length <= 90);
  useEffect(() => {
    if (!current || !autoClose) return;
    const timer = window.setTimeout(() => close(false), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [current, autoClose, close]);

  const api = useMemo<AlertApi>(
    () => ({
      success: (title, text) => push({ tone: "success", title, text }),
      error: (title, text) => push({ tone: "error", title, text }),
      warning: (title, text) => push({ tone: "warning", title, text }),
      info: (title, text) => push({ tone: "info", title, text }),
      confirm: (options) =>
        new Promise<boolean>((resolve) =>
          push({
            tone: options.tone ?? (options.destructive ? "warning" : "info"),
            title: options.title,
            text: options.text,
            confirm: {
              confirmLabel: options.confirmLabel ?? "Continue",
              cancelLabel: options.cancelLabel ?? "Cancel",
              destructive: Boolean(options.destructive),
              resolve,
            },
          }),
        ),
    }),
    [push],
  );

  return (
    <AlertContext.Provider value={api}>
      {children}
      <DialogPrimitive.Root open={current !== null} onOpenChange={(open) => (open ? undefined : close(false))}>
        <AnimatePresence>
          {current ? (
            <DialogPrimitive.Portal forceMount key={current.id}>
              <DialogPrimitive.Overlay forceMount asChild>
                <motion.div
                  className="fixed inset-0 z-[60] bg-brand-dark/45 backdrop-blur-[3px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                />
              </DialogPrimitive.Overlay>
              <div className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center p-4">
              <DialogPrimitive.Content
                forceMount
                asChild
                role={current.confirm ? "alertdialog" : "alert"}
                onOpenAutoFocus={(event) => {
                  // Focus the main button, not the first focusable thing.
                  event.preventDefault();
                  (document.getElementById("sweet-alert-primary") as HTMLButtonElement | null)?.focus();
                }}
              >
                <motion.div
                  className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-surface-raised px-6 pt-8 pb-6 text-center shadow-[var(--shadow-lg)] focus:outline-none"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 6 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 28 }}
                >
                  <AlertIcon tone={current.tone} />
                  <DialogPrimitive.Title className="mt-5 font-display text-xl font-medium text-ink">
                    {current.title}
                  </DialogPrimitive.Title>
                  {current.text ? (
                    <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate">
                      {current.text}
                    </DialogPrimitive.Description>
                  ) : (
                    <DialogPrimitive.Description className="sr-only">{current.title}</DialogPrimitive.Description>
                  )}
                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                    {current.confirm ? (
                      <>
                        <Button type="button" variant="secondary" onClick={() => close(false)}>
                          {current.confirm.cancelLabel}
                        </Button>
                        <Button
                          id="sweet-alert-primary"
                          type="button"
                          variant={current.confirm.destructive ? "danger" : "primary"}
                          onClick={() => close(true)}
                        >
                          {current.confirm.confirmLabel}
                        </Button>
                      </>
                    ) : (
                      <Button id="sweet-alert-primary" type="button" className="sm:min-w-28" onClick={() => close(false)}>
                        {current.tone === "success" ? "Great" : "OK"}
                      </Button>
                    )}
                  </div>
                  {autoClose && !reduceMotion ? (
                    <motion.span
                      aria-hidden
                      className="absolute bottom-0 left-0 h-1 bg-success/70"
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
                    />
                  ) : null}
                </motion.div>
              </DialogPrimitive.Content>
              </div>
            </DialogPrimitive.Portal>
          ) : null}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) throw new Error("useAlert must be used within AlertProvider");
  return context;
}
