import Link from "next/link";
import {
  getAnalyticsSnapshot,
  type AnalyticsRange,
} from "@/lib/admin/analytics";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function isRange(v: unknown): v is AnalyticsRange {
  return v === "7d" || v === "30d" || v === "90d" || v === "all";
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const min = sec / 60;
  return `${min.toFixed(1)} min`;
}

function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export default async function AdminAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range: AnalyticsRange = isRange(sp.range) ? sp.range : "30d";
  const snap = await getAnalyticsSnapshot(range);

  const funnel = snap.funnel;
  const funnelSteps = [
    { label: "Page views", value: funnel.pageView },
    { label: "Product views", value: funnel.pdpView },
    { label: "Add to cart", value: funnel.addToCart },
    { label: "WhatsApp click", value: funnel.whatsappClick },
  ];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));

  // Daily chart helpers — mirror /admin Dashboard.
  const maxDaily = Math.max(
    1,
    ...snap.daily.map((d) => Math.max(d.pageViews, d.addToCart)),
  );

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">Analytics</h1>
        <div className="ah-filter-tabs">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={`/admin/analytics?range=${opt.value}`}
              className={`ah-filter-tab${range === opt.value ? " is-active" : ""}`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="ah-tiles">
        <Tile label="Page views" value={snap.totals.pageViews} />
        <Tile label="Unique sessions" value={snap.totals.uniqueSessions} />
        <Tile label="Product views" value={snap.totals.pdpViews} />
        <Tile label="Cart adds" value={snap.totals.cartAdds} />
        <Tile
          label="Avg time / session"
          value={fmtMs(snap.engagement.avgDwellMs)}
          sub={`across sessions with at least one dwell event`}
        />
        <Tile
          label="Pages / session"
          value={snap.engagement.avgPagesPerSession.toFixed(2)}
        />
        <Tile
          label="Bounce rate"
          value={fmtPct(snap.engagement.bounceRatePct)}
          sub="sessions with exactly 1 page view"
        />
        <Tile
          label="WhatsApp clicks"
          value={snap.totals.whatsappClicks}
          sub="near-conversion · separate from main funnel"
        />
      </section>

      <section className="ah-card">
        <div className="ah-card-head">
          <div>
            <div className="ah-card-title">Funnel</div>
            <div className="ah-card-sub">
              Conversion-style drop-off across the buying steps.
            </div>
          </div>
        </div>
        <div className="ah-bars">
          {funnelSteps.map((s, i) => {
            const prev = i > 0 ? funnelSteps[i - 1]!.value : null;
            const drop =
              prev && prev > 0 ? ((prev - s.value) / prev) * 100 : null;
            return (
              <div key={s.label} className="ah-bar-row">
                <span className="ah-bar-label">{s.label}</span>
                <span className="ah-bar-track">
                  <span
                    className="ah-bar-fill"
                    style={{ width: `${(s.value / funnelMax) * 100}%` }}
                  />
                </span>
                <span className="ah-bar-count">
                  {s.value}
                  {drop != null && (
                    <span className="ah-bar-delta"> · -{drop.toFixed(0)}%</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ah-card">
        <div className="ah-card-head">
          <div>
            <div className="ah-card-title">Activity by product</div>
            <div className="ah-card-sub">
              Outlier flag = ≥30 views and WhatsApp rate under half the
              median — likely overpriced.
            </div>
          </div>
        </div>
        <div className="ah-table-wrap">
          <table className="ah-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Views</th>
                <th>Cart adds</th>
                <th>WhatsApp</th>
                <th>WA / view</th>
              </tr>
            </thead>
            <tbody>
              {snap.perProduct.length === 0 && (
                <tr>
                  <td colSpan={5} className="ah-table-empty">
                    No product activity in the selected range yet.
                  </td>
                </tr>
              )}
              {snap.perProduct.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <Link
                      href={`/admin/products?q=${encodeURIComponent(p.slug)}`}
                      className="ah-link"
                    >
                      {p.productName ?? p.slug}
                    </Link>
                    {p.isOutlier && (
                      <span className="ah-chip ah-chip--warn" style={{ marginLeft: 8 }}>
                        check price
                      </span>
                    )}
                  </td>
                  <td>{p.views}</td>
                  <td>{p.cartAdds}</td>
                  <td>{p.whatsappClicks}</td>
                  <td>
                    {p.waPerViewPct != null ? fmtPct(p.waPerViewPct) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ah-card">
        <div className="ah-card-head">
          <div>
            <div className="ah-card-title">Page views + cart adds · daily</div>
            <div className="ah-card-sub">UTC days, last {snap.daily.length}.</div>
          </div>
        </div>
        <div className="ah-mini-chart">
          {snap.daily.map((d) => (
            <div key={d.day} className="ah-mini-col" title={`${d.day} · views ${d.pageViews} · cart ${d.addToCart}`}>
              <span
                className="ah-mini-bar ah-mini-bar--a"
                style={{ height: `${(d.pageViews / maxDaily) * 100}%` }}
              />
              <span
                className="ah-mini-bar ah-mini-bar--b"
                style={{ height: `${(d.addToCart / maxDaily) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="ah-mini-legend">
          <span><span className="ah-mini-swatch ah-mini-swatch--a" /> Page views</span>
          <span><span className="ah-mini-swatch ah-mini-swatch--b" /> Cart adds</span>
        </div>
      </section>

      <section className="ah-grid-2">
        <div className="ah-card">
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Top filters used</div>
            </div>
          </div>
          <ul className="ah-list">
            {snap.topFilters.length === 0 && (
              <li className="ah-list-empty">No filter activity yet.</li>
            )}
            {snap.topFilters.map((f) => (
              <li key={`${f.key}=${f.value}`} className="ah-list-row">
                <span>
                  <strong>{f.key}</strong>: {f.value}
                </span>
                <span className="ah-list-count">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ah-card">
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Outbound + share</div>
            </div>
          </div>
          <ul className="ah-list">
            <li className="ah-list-row">
              <span>Share button clicks</span>
              <span className="ah-list-count">{snap.shareClicks}</span>
            </li>
            {snap.socialOutbound.map((s) => (
              <li key={s.network} className="ah-list-row">
                <span>Outbound · {s.network}</span>
                <span className="ah-list-count">{s.count}</span>
              </li>
            ))}
            {snap.socialOutbound.length === 0 && (
              <li className="ah-list-empty">
                No outbound clicks yet (Instagram / TikTok links).
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="ah-tile">
      <div className="ah-tile-label">{label}</div>
      <div className="ah-tile-value">{value}</div>
      {sub && <div className="ah-tile-sub">{sub}</div>}
    </div>
  );
}
