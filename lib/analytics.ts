// Centralized typed analytics wrapper. Two backends:
//   - Vercel Web Analytics (always on in production via @vercel/analytics)
//   - Meta Pixel (only when NEXT_PUBLIC_META_PIXEL_ID is set; injected from layout)
//
// Use trackEvent() for first-party funnel events. Use trackMetaEvent() to
// fire matching standard Pixel events for ad attribution.

import { track } from "@vercel/analytics";

type Currency = "USD" | "ARS";

type TrackEventMap = {
  whatsapp_click_product: {
    slug: string;
    productName: string;
    price: number;
    currency: Currency;
    line: string;
  };
  whatsapp_click_cart: {
    itemCount: number;
    totalUSD: number;
    slugs: string[];
  };
  share_click: {
    slug: string;
    productName: string;
    method: "native" | "copy";
  };
  catalog_filter_apply: {
    line?: string;
    series?: string;
    availability?: string;
  };
};

type TrackEventName = keyof TrackEventMap;

// Vercel Analytics' track() accepts Record<string, AllowedPropertyValue>.
// Cast inside since our generic narrows correctly per call site.
type VercelProps = Record<string, string | number | boolean | null>;

/**
 * Fire a typed analytics event. Never throws — failures are swallowed so the
 * surrounding action (wa.me redirect, navigator.share, filter apply) is never
 * blocked by analytics.
 */
export function trackEvent<E extends TrackEventName>(
  event: E,
  props: TrackEventMap[E],
): void {
  try {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[analytics]", event, props);
    }
    // Vercel Analytics rejects undefined values; strip them.
    const cleaned: VercelProps = {};
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) continue;
      // Arrays are not supported in Vercel Analytics props — join to string.
      if (Array.isArray(v)) {
        cleaned[k] = v.join(",");
      } else {
        cleaned[k] = v as VercelProps[string];
      }
    }
    track(event, cleaned);
  } catch {
    // Defensive: never let analytics break user actions.
  }
}

// ---- Meta Pixel ------------------------------------------------------------

type FbqFn = (
  command: "track" | "trackCustom" | "init" | "consent",
  ...args: unknown[]
) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

/**
 * Fire a Meta Pixel event. No-ops if fbq isn't loaded (pixel disabled or not
 * yet hydrated). Used in parallel with trackEvent for ad attribution.
 */
export function trackMetaEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  try {
    if (typeof window === "undefined") return;
    if (typeof window.fbq !== "function") return;
    if (params) {
      window.fbq("track", name, params);
    } else {
      window.fbq("track", name);
    }
  } catch {
    // Defensive: never let Pixel break user actions.
  }
}
