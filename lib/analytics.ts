// Centralized typed analytics wrapper. Three backends:
//   - Vercel Web Analytics (always on in production via @vercel/analytics)
//   - Meta Pixel (only when NEXT_PUBLIC_META_PIXEL_ID is set; injected from layout)
//   - First-party `/api/track` ingest → Supabase `analytics_events`
//     (drives the custom admin Analytics tab; survives Vercel limits
//     and gives us SQL-queryable rows for per-product engagement)
//
// Use trackEvent() for first-party funnel events. Use trackMetaEvent() to
// fire matching standard Pixel events for ad attribution.

import { track } from "@vercel/analytics";
import { getOrCreateSessionId } from "./sessionId";

type Currency = "USD" | "ARS";

type TrackEventMap = {
  page_view: {
    referrer?: string;
  };
  page_dwell: {
    ms: number;
  };
  pdp_view: {
    slug: string;
    productName: string;
    line: string;
    series?: string;
    price: number;
    currency: Currency;
  };
  add_to_cart: {
    slug: string;
    productName: string;
    price: number;
    currency: Currency;
    line: string;
  };
  remove_from_cart: {
    slug: string;
  };
  cart_open: {
    itemCount: number;
  };
  share_click: {
    slug: string;
    productName: string;
    method: "native" | "copy";
  };
  social_outbound: {
    network: string;
    sourcePath: string;
  };
  catalog_filter_apply: {
    line?: string;
    series?: string;
    availability?: string;
  };
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
};

type TrackEventName = keyof TrackEventMap;

// Vercel Analytics' track() accepts Record<string, AllowedPropertyValue>.
// Cast inside since our generic narrows correctly per call site.
type VercelProps = Record<string, string | number | boolean | null>;

/**
 * Fire a typed analytics event. Never throws — failures are swallowed so the
 * surrounding action (wa.me redirect, navigator.share, filter apply) is never
 * blocked by analytics. Mirrors the event to both Vercel Analytics
 * (bird's-eye) and the first-party `/api/track` endpoint (powers the
 * admin Analytics tab + per-product engagement queries).
 */
export function trackEvent<E extends TrackEventName>(
  event: E,
  props: TrackEventMap[E],
): void {
  try {
    if (process.env.NODE_ENV === "development") {
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
    // First-party mirror — fire-and-forget. `sendBeacon` is preferred
    // because it survives navigation (matters for whatsapp_click_*),
    // falls back to fetch with `keepalive` when unavailable.
    sendBeacon(event, props as Record<string, unknown>);
  } catch {
    // Defensive: never let analytics break user actions.
  }
}

function sendBeacon(event: string, props: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    event,
    props,
    session_id: getOrCreateSessionId(),
    path: window.location.pathname + window.location.search,
  });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
      return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Swallow — analytics is non-essential.
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
