"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { hashFromHref, scrollToHash, scrollToTop } from "@/lib/smooth-scroll";

type SmoothLinkProps = ComponentProps<typeof Link>;

export function SmoothLink({ href, onClick, ...props }: SmoothLinkProps) {
  const pathname = usePathname();
  const hrefString = typeof href === "string" ? href : href.pathname ?? "";
  const hash = typeof href === "string" ? hashFromHref(href) : null;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
      return;
    }

    if (hrefString === "/" && pathname === "/") {
      event.preventDefault();
      scrollToTop();
      return;
    }

    if (hash && (pathname === "/" || hrefString.startsWith("#"))) {
      event.preventDefault();
      if (scrollToHash(hash)) {
        window.history.pushState(null, "", `/#${hash}`);
      }
    }
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
