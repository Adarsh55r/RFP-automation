import type { ReactNode } from "react";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/cn";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-24 py-16 md:py-24", className)}>
      <Reveal className="mx-auto max-w-content px-6 md:px-8">{children}</Reveal>
    </section>
  );
}
