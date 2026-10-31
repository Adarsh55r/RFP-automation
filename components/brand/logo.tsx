import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  markClassName?: string;
  withWordmark?: boolean;
};

/**
 * DraftBid AI mark: a bold "D" shaped like a bound draft (flat spine,
 * rounded page edge) with a gold four-point spark for the AI that writes it.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8 shrink-0", className)}
      aria-hidden
    >
      <path
        d="M7 3.5h7.5a12.5 12.5 0 0 1 0 25H7A3 3 0 0 1 4 25.5v-19a3 3 0 0 1 3-3Z"
        className="fill-brand"
      />
      <path
        d="M14.5 8.5Q15.1 15.4 22 16Q15.1 16.6 14.5 23.5Q13.9 16.6 7 16Q13.9 15.4 14.5 8.5Z"
        className="fill-accent"
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
        <span className="font-display text-base font-semibold tracking-tight">
          DraftBid<span className="ml-[0.16em] text-accent">AI</span>
        </span>
      ) : (
        <span className="sr-only">DraftBid AI</span>
      )}
    </span>
  );
}
