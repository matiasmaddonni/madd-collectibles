"use client";

// Thin client wrapper around a social-network link so the footer
// can stay a server component but still emit a `social_outbound`
// event when the user clicks through to Instagram / TikTok / etc.

import { trackEvent } from "@/lib/analytics";

type Props = {
  network: string;
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
};

export function SocialAnchor({
  network,
  href,
  ariaLabel,
  children,
  className,
}: Props) {
  const onClick = () => {
    const sourcePath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "";
    trackEvent("social_outbound", { network, sourcePath });
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
    >
      {children}
    </a>
  );
}
