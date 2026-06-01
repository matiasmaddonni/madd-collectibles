// Admin Analytics page data layer. One pass over `analytics_events`
// (clamped to the requested window) feeds every tile, table and
// chart on /admin/analytics — sticking to a single round-trip keeps
// the dashboard snappy while the dataset is small (<200k rows) and
// avoids fighting Supabase row caps.

import { createAdminClient } from "@/lib/supabase/admin";

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

type Row = {
  event: string;
  props: Record<string, unknown> | null;
  session_id: string;
  created_at: string;
  path: string | null;
};

export type AnalyticsSnapshot = {
  range: AnalyticsRange;
  rangeStartISO: string | null;

  // Top-line tiles
  totals: {
    pageViews: number;
    uniqueSessions: number;
    pdpViews: number;
    cartAdds: number;
    whatsappClicks: number; // product + cart combined
  };

  // Engagement
  engagement: {
    avgDwellMs: number; // mean ms per session
    avgPagesPerSession: number;
    bounceRatePct: number; // sessions with exactly 1 page_view
  };

  // Funnel (counts, not unique sessions)
  funnel: {
    pageView: number;
    pdpView: number;
    addToCart: number;
    whatsappClick: number;
  };

  // Per-product activity
  perProduct: Array<{
    slug: string;
    productName: string | null;
    views: number;
    cartAdds: number;
    whatsappClicks: number;
    waPerViewPct: number | null;
    isOutlier: boolean; // views ≥ 30 AND waPerView < median * 0.5
  }>;

  // Top filters used
  topFilters: Array<{ key: string; value: string; count: number }>;

  // Share / social outbound
  shareClicks: number;
  socialOutbound: Array<{ network: string; count: number }>;

  // Daily series for the chart: pageViews + addToCart per day (UTC)
  daily: Array<{
    day: string; // YYYY-MM-DD
    pageViews: number;
    addToCart: number;
  }>;
};

function rangeStart(range: AnalyticsRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

function pickString(o: unknown, key: string): string | null {
  if (!o || typeof o !== "object") return null;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function pickNumber(o: unknown, key: string): number | null {
  if (!o || typeof o !== "object") return null;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function getAnalyticsSnapshot(
  range: AnalyticsRange,
): Promise<AnalyticsSnapshot> {
  const admin = createAdminClient();
  const start = rangeStart(range);

  let query = admin
    .from("analytics_events")
    .select("event, props, session_id, created_at, path")
    .order("created_at", { ascending: true });
  if (start) query = query.gte("created_at", start.toISOString());
  // Hard cap so a runaway query doesn't OOM the function. 200k rows
  // covers ~4 months of moderate traffic; if we hit it, the dashboard
  // shows the more-recent slice, which is what the admin cares about.
  const { data, error } = await query.limit(200_000);
  if (error) {
    console.error("[analytics] query failed", error);
  }
  const rows = ((data ?? []) as unknown as Row[]) ?? [];

  // ---- single-pass aggregation ----
  const byEvent = new Map<string, number>();
  const sessions = new Set<string>();
  const pageViewsPerSession = new Map<string, number>();
  // session_id -> [path, t]
  type Visit = { path: string | null; t: number };
  const lastViewBySession = new Map<string, Visit>();
  // session_id -> ms dwell accumulated
  const dwellMsPerSession = new Map<string, number>();

  const productSlugAgg = new Map<
    string,
    { name: string | null; views: number; cartAdds: number; wa: number }
  >();
  const filterAgg = new Map<string, number>(); // "key=value" -> count
  const socialAgg = new Map<string, number>();
  let shareClicks = 0;

  // daily buckets keyed by UTC YYYY-MM-DD
  const dailyPageViews = new Map<string, number>();
  const dailyCartAdds = new Map<string, number>();

  function bumpProduct(
    slug: string,
    name: string | null,
    kind: "views" | "cartAdds" | "wa",
  ) {
    const cur = productSlugAgg.get(slug) ?? {
      name,
      views: 0,
      cartAdds: 0,
      wa: 0,
    };
    if (!cur.name && name) cur.name = name;
    cur[kind] = cur[kind] + 1;
    productSlugAgg.set(slug, cur);
  }

  for (const r of rows) {
    byEvent.set(r.event, (byEvent.get(r.event) ?? 0) + 1);
    sessions.add(r.session_id);
    const dayKey = r.created_at.slice(0, 10);

    if (r.event === "page_view") {
      pageViewsPerSession.set(
        r.session_id,
        (pageViewsPerSession.get(r.session_id) ?? 0) + 1,
      );
      dailyPageViews.set(dayKey, (dailyPageViews.get(dayKey) ?? 0) + 1);
      lastViewBySession.set(r.session_id, {
        path: r.path,
        t: new Date(r.created_at).getTime(),
      });
    } else if (r.event === "page_dwell") {
      const ms = pickNumber(r.props, "ms");
      if (ms != null && ms > 0) {
        dwellMsPerSession.set(
          r.session_id,
          (dwellMsPerSession.get(r.session_id) ?? 0) + ms,
        );
      }
    } else if (r.event === "pdp_view") {
      const slug = pickString(r.props, "slug");
      if (slug) {
        bumpProduct(slug, pickString(r.props, "productName"), "views");
      }
    } else if (r.event === "add_to_cart") {
      const slug = pickString(r.props, "slug");
      if (slug) {
        bumpProduct(slug, pickString(r.props, "productName"), "cartAdds");
      }
      dailyCartAdds.set(dayKey, (dailyCartAdds.get(dayKey) ?? 0) + 1);
    } else if (r.event === "whatsapp_click_product") {
      const slug = pickString(r.props, "slug");
      if (slug) {
        bumpProduct(slug, pickString(r.props, "productName"), "wa");
      }
    } else if (r.event === "share_click") {
      shareClicks++;
    } else if (r.event === "social_outbound") {
      const network = pickString(r.props, "network");
      if (network) {
        socialAgg.set(network, (socialAgg.get(network) ?? 0) + 1);
      }
    } else if (r.event === "catalog_filter_apply") {
      const p = r.props ?? {};
      for (const key of ["line", "series", "availability"] as const) {
        const v = pickString(p, key);
        if (v) {
          const k = `${key}=${v}`;
          filterAgg.set(k, (filterAgg.get(k) ?? 0) + 1);
        }
      }
    }
  }

  // ---- derived metrics ----
  const totalSessions = sessions.size;
  const totalPageViews = byEvent.get("page_view") ?? 0;
  const cartAddsTotal = byEvent.get("add_to_cart") ?? 0;
  const waProductTotal = byEvent.get("whatsapp_click_product") ?? 0;
  const waCartTotal = byEvent.get("whatsapp_click_cart") ?? 0;

  const avgPagesPerSession =
    totalSessions > 0 ? totalPageViews / totalSessions : 0;

  const bouncedSessions = Array.from(pageViewsPerSession.values()).filter(
    (n) => n === 1,
  ).length;
  const bounceRatePct =
    totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

  const totalDwellMs = Array.from(dwellMsPerSession.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const sessionsWithDwell = dwellMsPerSession.size;
  const avgDwellMs =
    sessionsWithDwell > 0 ? totalDwellMs / sessionsWithDwell : 0;

  // Per-product list + outlier flag
  const productList = Array.from(productSlugAgg.entries()).map(
    ([slug, agg]) => ({
      slug,
      productName: agg.name,
      views: agg.views,
      cartAdds: agg.cartAdds,
      whatsappClicks: agg.wa,
      waPerViewPct: agg.views > 0 ? (agg.wa / agg.views) * 100 : null,
    }),
  );
  // Median WA-rate across products with non-trivial view volume
  const eligible = productList.filter((p) => p.views >= 30 && p.waPerViewPct != null);
  let medianWaRate = 0;
  if (eligible.length > 0) {
    const rates = eligible
      .map((p) => p.waPerViewPct!)
      .sort((a, b) => a - b);
    medianWaRate = rates[Math.floor(rates.length / 2)] ?? 0;
  }
  const perProduct = productList
    .map((p) => ({
      ...p,
      isOutlier:
        p.views >= 30 &&
        p.waPerViewPct != null &&
        medianWaRate > 0 &&
        p.waPerViewPct < medianWaRate * 0.5,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 30);

  const topFilters = Array.from(filterAgg.entries())
    .map(([k, count]) => {
      const eq = k.indexOf("=");
      return { key: k.slice(0, eq), value: k.slice(eq + 1), count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const socialOutbound = Array.from(socialAgg.entries())
    .map(([network, count]) => ({ network, count }))
    .sort((a, b) => b.count - a.count);

  // Daily series — emit every day in the range (zero-fill) so charts
  // don't visually compress gaps.
  const dailyKeys = new Set<string>();
  for (const k of dailyPageViews.keys()) dailyKeys.add(k);
  for (const k of dailyCartAdds.keys()) dailyKeys.add(k);
  if (start) {
    const cursor = new Date(start);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    while (cursor <= today) {
      dailyKeys.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const daily = Array.from(dailyKeys)
    .sort()
    .map((day) => ({
      day,
      pageViews: dailyPageViews.get(day) ?? 0,
      addToCart: dailyCartAdds.get(day) ?? 0,
    }));

  return {
    range,
    rangeStartISO: start?.toISOString() ?? null,
    totals: {
      pageViews: totalPageViews,
      uniqueSessions: totalSessions,
      pdpViews: byEvent.get("pdp_view") ?? 0,
      cartAdds: cartAddsTotal,
      whatsappClicks: waProductTotal + waCartTotal,
    },
    engagement: {
      avgDwellMs,
      avgPagesPerSession,
      bounceRatePct,
    },
    funnel: {
      pageView: totalPageViews,
      pdpView: byEvent.get("pdp_view") ?? 0,
      addToCart: cartAddsTotal,
      whatsappClick: waProductTotal + waCartTotal,
    },
    perProduct,
    topFilters,
    shareClicks,
    socialOutbound,
    daily,
  };
}
