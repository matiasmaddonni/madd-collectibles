import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsdToArsRate, convertArsToUsd } from "@/lib/currency";
import { formatRelative } from "./products/_components/relativeTime";

export const dynamic = "force-dynamic";

type Status = "draft" | "available" | "reserved" | "sold";

type ProductBase = {
  id: string;
  status: Status;
  price: number;
  currency: string;
  product_line_id: string | null;
  description: string | null;
  sold_at: string | null;
  reserved_at: string | null;
  created_at: string;
  updated_at: string;
};

type RecentSold = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  sold_at: string;
  product_line:
    | { name: string }
    | { name: string }[]
    | null;
};

type ReservedRow = {
  id: string;
  name: string;
  slug: string;
  reserved_at: string;
  product_line:
    | { name: string }
    | { name: string }[]
    | null;
};

function getOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const CHART_DAYS = 30;
const DAY_MS = 86_400_000;

export default async function AdminDashboard() {
  const admin = createAdminClient();
  // USD-blue rate. Cached 1h via fetch revalidate. Use once for all aggregate
  // sums + chart revenue so ARS rows contribute to USD totals.
  const usdRate = await getUsdToArsRate();
  const toUsd = (price: number, currency: string): number =>
    currency === "ARS" ? convertArsToUsd(price, usdRate) : Number(price) || 0;

  // Try the rich query first (needs migration 013). Fall back to a basic
  // query without sold_at/reserved_at so the dashboard still works
  // pre-migration -- some sections just go empty.
  const richSelect =
    "id, status, price, currency, product_line_id, description, sold_at, reserved_at, created_at, updated_at";
  const basicSelect =
    "id, status, price, currency, product_line_id, description, created_at, updated_at";

  const richAll = await admin.from("products").select(richSelect);
  const hasTimestamps = !richAll.error;

  const [allRes, recentSoldRes, reservedRes, linesRes, imageProductIdsRes] =
    await Promise.all([
      hasTimestamps
        ? Promise.resolve(richAll)
        : admin.from("products").select(basicSelect),
      hasTimestamps
        ? admin
            .from("products")
            .select(
              "id, name, slug, price, currency, sold_at, product_line:product_lines(name)",
            )
            .eq("status", "sold")
            .not("sold_at", "is", null)
            .order("sold_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      hasTimestamps
        ? admin
            .from("products")
            .select(
              "id, name, slug, reserved_at, product_line:product_lines(name)",
            )
            .eq("status", "reserved")
            .order("reserved_at", {
              ascending: true,
              nullsFirst: false,
            })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      admin.from("product_lines").select("id, name, slug").order("name"),
      admin.from("product_images").select("product_id"),
    ]);

  const all = ((allRes.data ?? []) as Array<Partial<ProductBase> & {
    id: string;
    status: Status;
    price: number;
    currency: string;
    product_line_id: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>).map((p) => ({
    ...p,
    sold_at: p.sold_at ?? null,
    reserved_at: p.reserved_at ?? null,
  })) as ProductBase[];
  const recentSold = (recentSoldRes.data ?? []) as unknown as RecentSold[];
  const reserved = (reservedRes.data ?? []) as unknown as ReservedRow[];
  const lines = (linesRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  const productsWithImages = new Set(
    (imageProductIdsRes.data ?? []).map(
      (r) => (r as { product_id: string }).product_id,
    ),
  );

  // Tile aggregates.
  let total = 0;
  let available = 0;
  let reservedCount = 0;
  let soldCount = 0;
  let inventoryValueUSD = 0;
  let missingPhotos = 0;
  let missingDescription = 0;
  let missingPrice = 0;
  let staleReserved = 0;
  let draftsReady = 0;

  // Dashboard "now" — Date.now() in a server component is the request time,
  // which is exactly the "today" we want for the stale-reservation cutoff.
  // ESLint's react-hooks/purity flags this defensively; the
  // dashboard intentionally re-evaluates on every render.
  // eslint-disable-next-line react-hooks/purity
  const fourteenDaysAgo = Date.now() - 14 * DAY_MS;

  // Stock by line: count of `available` items per product_line_id.
  const stockByLine = new Map<string, number>();

  for (const p of all) {
    total++;
    if (p.status === "available") {
      available++;
      inventoryValueUSD += toUsd(Number(p.price) || 0, p.currency);
      if (p.product_line_id) {
        stockByLine.set(
          p.product_line_id,
          (stockByLine.get(p.product_line_id) ?? 0) + 1,
        );
      }
      if (!productsWithImages.has(p.id)) missingPhotos++;
      const hasDesc = p.description && p.description.trim() !== "";
      if (!hasDesc) missingDescription++;
      if (Number(p.price) === 0) missingPrice++;
    } else if (p.status === "reserved") {
      reservedCount++;
      const reservedAt = p.reserved_at ? new Date(p.reserved_at).getTime() : 0;
      if (reservedAt > 0 && reservedAt < fourteenDaysAgo) staleReserved++;
    } else if (p.status === "sold") {
      soldCount++;
    } else if (p.status === "draft") {
      const hasDesc = p.description && p.description.trim() !== "";
      if (
        hasDesc &&
        Number(p.price) > 0 &&
        productsWithImages.has(p.id)
      ) {
        draftsReady++;
      }
    }
  }


  // Sales chart: bucket sold-by-day for last CHART_DAYS days.
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startTs = now.getTime() - (CHART_DAYS - 1) * DAY_MS;
  const buckets: number[] = Array(CHART_DAYS).fill(0);
  let chartSoldTotal = 0;
  let chartRevenue = 0;
  for (const p of all) {
    if (p.status !== "sold" || !p.sold_at) continue;
    const t = new Date(p.sold_at).getTime();
    if (t < startTs) continue;
    const idx = Math.floor((t - startTs) / DAY_MS);
    if (idx >= 0 && idx < CHART_DAYS) {
      buckets[idx]++;
      chartSoldTotal++;
      chartRevenue += toUsd(Number(p.price) || 0, p.currency);
    }
  }
  const maxBucket = Math.max(1, ...buckets);

  // Stock-by-line: sort lines by count desc, top 8.
  const stockLines = lines
    .map((l) => ({ ...l, count: stockByLine.get(l.id) ?? 0 }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxLineCount = Math.max(1, ...stockLines.map((l) => l.count));
  const stockLineTotal = stockLines.reduce((s, l) => s + l.count, 0);

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">Dashboard</h1>
      </div>

      <section className="ah-tiles">
        <Tile label="Total" value={total} />
        <Tile label="Available" value={available} />
        <Tile label="Reserved" value={reservedCount} />
        <Tile label="Sold" value={soldCount} />
        <Tile
          label="Inventory value"
          value={`$${Math.round(inventoryValueUSD).toLocaleString()}`}
          sub={`available · USD @ ${usdRate.toFixed(0)}`}
          wide
        />
      </section>

      <section className="ah-card">
        <div className="ah-card-head">
          <div>
            <div className="ah-card-title">Sales over time</div>
            <div className="ah-card-sub">
              Units sold per day · last {CHART_DAYS} days
            </div>
          </div>
        </div>

        <div className="ah-chart-head">
          <div>
            <div className="ah-chart-stat-value">{chartSoldTotal}</div>
            <div className="ah-chart-stat-label">units sold in range</div>
          </div>
          <div>
            <div className="ah-chart-stat-value">
              ${Math.round(chartRevenue).toLocaleString()}
            </div>
            <div className="ah-chart-stat-label">approx revenue · USD</div>
          </div>
        </div>

        <SalesChart buckets={buckets} max={maxBucket} startTs={startTs} />
      </section>

      <section className="ah-grid-2">
        <div className="ah-card">
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Stock by line</div>
              <div className="ah-card-sub">Available units only</div>
            </div>
            <span className="ah-toolbar-meta">{stockLineTotal} total</span>
          </div>
          <div className="ah-bars">
            {stockLines.length === 0 ? (
              <div className="ah-list-empty">Nothing available yet.</div>
            ) : (
              stockLines.map((l) => {
                const sharePct = stockLineTotal > 0 ? (l.count / stockLineTotal) * 100 : 0;
                const tier =
                  sharePct >= 25 ? "high" : sharePct >= 10 ? "med" : "low";
                return (
                  <Link
                    key={l.id}
                    href={`/admin/products?status=available&line=${l.slug}`}
                    className="ah-bar-row"
                    title={`${sharePct.toFixed(1)}% of available stock`}
                  >
                    <span className="ah-bar-label">{l.name}</span>
                    <span className="ah-bar-track">
                      <span
                        className={`ah-bar-fill ah-bar-fill--${tier}`}
                        style={{ width: `${(l.count / maxLineCount) * 100}%` }}
                      />
                    </span>
                    <span className="ah-bar-count">{l.count}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="ah-card">
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Needs attention</div>
              <div className="ah-card-sub">Click to filter products</div>
            </div>
          </div>
          <div className="ah-action-list">
            <ActionRow
              level="high"
              label="Missing photos"
              count={missingPhotos}
              href="/admin/products?missing=photos"
            />
            <ActionRow
              level="high"
              label="Missing price"
              count={missingPrice}
              href="/admin/products?missing=price"
            />
            <ActionRow
              level="med"
              label="Missing description"
              count={missingDescription}
              href="/admin/products?missing=description"
            />
            <ActionRow
              level="med"
              label={`Reserved > 14 days`}
              count={staleReserved}
              href="/admin/products?status=reserved"
            />
            <ActionRow
              level="low"
              label="Drafts ready to publish"
              count={draftsReady}
              href="/admin/products?status=draft"
            />
          </div>
        </div>
      </section>

      <section className="ah-grid-2">
        <div className="ah-card">
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Recently sold</div>
              <div className="ah-card-sub">Last 5</div>
            </div>
          </div>
          <div className="ah-list">
            {recentSold.length === 0 ? (
              <div className="ah-list-empty">No sales yet.</div>
            ) : (
              recentSold.map((p) => {
                const line = getOne(p.product_line);
                return (
                  <Link
                    key={p.id}
                    href={`/admin/products/${p.id}`}
                    className="ah-list-row"
                  >
                    <div>
                      <div className="ah-list-name">{p.name}</div>
                      <div className="ah-list-sub">{line?.name ?? ""}</div>
                    </div>
                    <div className="ah-list-meta">
                      {p.currency} {p.price}
                      <div className="ah-list-sub" style={{ textAlign: "right" }}>
                        {formatRelative(p.sold_at)}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="ah-card">
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Reserved by age</div>
              <div className="ah-card-sub">Oldest first</div>
            </div>
          </div>
          <div className="ah-list">
            {reserved.length === 0 ? (
              <div className="ah-list-empty">Nothing reserved.</div>
            ) : (
              reserved.map((p) => {
                const line = getOne(p.product_line);
                // Server-time "now" again — see comment on line 146.
                const days = p.reserved_at
                  ? Math.floor(
                      // eslint-disable-next-line react-hooks/purity
                      (Date.now() - new Date(p.reserved_at).getTime()) / DAY_MS,
                    )
                  : null;
                const stale = days !== null && days > 14;
                return (
                  <Link
                    key={p.id}
                    href={`/admin/products/${p.id}`}
                    className="ah-list-row"
                  >
                    <div>
                      <div className="ah-list-name">{p.name}</div>
                      <div className="ah-list-sub">{line?.name ?? ""}</div>
                    </div>
                    <div
                      className="ah-list-meta"
                      style={{ color: stale ? "var(--ah-warn)" : undefined }}
                    >
                      {days === null ? "?" : `${days}d reserved`}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  wide,
}: {
  label: string;
  value: number | string;
  sub?: string;
  wide?: boolean;
}) {
  return (
    <div className={`ah-tile${wide ? " ah-tile--wide" : ""}`}>
      <div className="ah-tile-label">{label}</div>
      <div className="ah-tile-value">{value}</div>
      {sub && <div className="ah-tile-sub">{sub}</div>}
    </div>
  );
}

function ActionRow({
  level,
  label,
  count,
  href,
}: {
  level: "high" | "med" | "low";
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link href={href} className="ah-action-row">
      <span className={`ah-action-dot ah-action-dot--${level}`} />
      <span className="ah-action-label">{label}</span>
      <span className="ah-action-count">{count}</span>
      <span className="ah-action-arrow">→</span>
    </Link>
  );
}

function SalesChart({
  buckets,
  max,
  startTs,
}: {
  buckets: number[];
  max: number;
  startTs: number;
}) {
  const W = 720;
  const H = 140;
  const padBottom = 18;
  const padLeft = 24;
  const gridY = [0, H - padBottom, (H - padBottom) / 2];
  const usableH = H - padBottom;
  const usableW = W - padLeft;
  const barW = usableW / buckets.length;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dateLabel = (ts: number) => {
    const d = new Date(ts);
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };
  const tickEvery = Math.max(1, Math.floor(buckets.length / 4));
  return (
    <svg
      className="ah-chart-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* grid */}
      <line
        className="ah-chart-grid"
        x1={padLeft}
        x2={W}
        y1={gridY[1]}
        y2={gridY[1]}
      />
      <line
        className="ah-chart-grid"
        x1={padLeft}
        x2={W}
        y1={gridY[2]}
        y2={gridY[2]}
      />
      {/* axis labels (Y) */}
      <text className="ah-chart-axis" x={2} y={10}>
        {max}
      </text>
      <text className="ah-chart-axis" x={2} y={gridY[2] + 3}>
        {Math.round(max / 2)}
      </text>
      <text className="ah-chart-axis" x={2} y={gridY[1] - 2}>
        0
      </text>
      {/* bars */}
      {buckets.map((v, i) => {
        const h = Math.max(0.5, (v / max) * usableH);
        const x = padLeft + i * barW + 1;
        const y = usableH - h;
        return (
          <rect
            key={i}
            className="ah-chart-bar"
            x={x}
            y={y}
            width={Math.max(1, barW - 2)}
            height={h}
          />
        );
      })}
      {/* X axis labels */}
      {buckets.map((_, i) =>
        i % tickEvery === 0 || i === buckets.length - 1 ? (
          <text
            key={i}
            className="ah-chart-axis"
            x={padLeft + i * barW + barW / 2}
            y={H - 4}
            textAnchor="middle"
          >
            {dateLabel(startTs + i * DAY_MS)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
