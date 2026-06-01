"use client";

// Mounted once in app/layout. Fires:
//   - page_view on initial mount + every client-side route change
//   - page_dwell on route change / pagehide / visibilitychange=hidden,
//     reporting how many ms the page was visible. Time spent in a
//     background tab is excluded so "engaged time" is what shows up.
//
// `trackEvent` already handles session_id stitching, beacon dispatch,
// and graceful failure — this component just owns the timing logic.

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  // Stable key per addressable page. Treat query-string changes as a
  // new view (filters on /catalogo are meaningful for analytics).
  const pageKey = `${pathname}${search ? `?${search}` : ""}`;

  // Visible-only accumulator. `visibleSinceRef` is the moment the
  // current visible run started; null while the tab is in the
  // background. `accumulatedRef` is total visible ms across runs on
  // this view.
  const visibleSinceRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const referrerRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Reset accumulator for the new page.
    accumulatedRef.current = 0;
    visibleSinceRef.current =
      document.visibilityState === "visible" ? Date.now() : null;

    // Capture document.referrer once per route — empty after the first
    // SPA navigation, which is fine.
    const ref = document.referrer || referrerRef.current || "";
    referrerRef.current = ref;

    trackEvent("page_view", { referrer: ref || undefined });

    const flushDwell = () => {
      if (visibleSinceRef.current != null) {
        accumulatedRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
      const ms = Math.round(accumulatedRef.current);
      if (ms > 500) {
        // Skip sub-500ms flicker noise.
        trackEvent("page_dwell", { ms });
      }
      accumulatedRef.current = 0;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (visibleSinceRef.current == null) {
          visibleSinceRef.current = Date.now();
        }
      } else {
        if (visibleSinceRef.current != null) {
          accumulatedRef.current += Date.now() - visibleSinceRef.current;
          visibleSinceRef.current = null;
        }
      }
    };

    const onPageHide = () => {
      flushDwell();
    };

    document.addEventListener("visibilitychange", onVisibility);
    // pagehide is more reliable than beforeunload on mobile + bfcache.
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // SPA route change unmount — flush dwell for the page we're
      // leaving so the next page_view starts a clean counter.
      flushDwell();
    };
    // pageKey covers both pathname + search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  return null;
}
