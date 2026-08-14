import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  markClassName?: string;
  withWordmark?: boolean;
};

/**
 * Folio mark: a turned RFP settling into one clean draft,
 * with a gold dog-ear for the ready-to-send / win state.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      overflow="visible"
      className={cn("size-8 shrink-0", className)}
      aria-hidden
    >
      <rect
        x="10"
        y="3.5"
        width="16"
        height="21"
        rx="2.75"
        className="fill-brand/40"
        transform="rotate(13 18 14)"
      />
      <rect
        x="5"
        y="7"
        width="16.5"
        height="21.5"
        rx="2.75"
        className="fill-brand"
      />
      <path d="M21.5 7v8L13.5 7h8Z" className="fill-accent" />
      <path
        d="M13.5 7 21.5 15"
        className="stroke-brand-dark/35"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      <rect
        x="8"
        y="18"
        width="10"
        height="1.4"
        rx="0.7"
        className="fill-surface-raised/90"
      />
      <rect
        x="8"
        y="21.5"
        width="6.5"
        height="1.4"
        rx="0.7"
        className="fill-surface-raised/50"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  withWordmark = true,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      {withWordmark ? (
        <span className="font-sans text-base font-semibold tracking-tight">
          DraftWin
        </span>
      ) : (
        <span className="sr-only">DraftWin</span>
      )}
    </span>
  );
}
