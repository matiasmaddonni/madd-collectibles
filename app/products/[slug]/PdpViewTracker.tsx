"use client";

// Fires a `pdp_view` event on mount. Mounted by the server-rendered
// PDP page so the dashboard can rank products by views without
// needing to grep page_view paths for "/products/<slug>". Carries
// enough of the product context to keep per-line / per-price
// analytics tractable.

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = {
  slug: string;
  productName: string;
  line: string;
  series?: string | null;
  price: number;
  currency: "USD" | "ARS";
};

export function PdpViewTracker({
  slug,
  productName,
  line,
  series,
  price,
  currency,
}: Props) {
  useEffect(() => {
    trackEvent("pdp_view", {
      slug,
      productName,
      line,
      ...(series ? { series } : {}),
      price,
      currency,
    });
  }, [slug, productName, line, series, price, currency]);
  return null;
}
