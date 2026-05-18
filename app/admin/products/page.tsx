import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Toolbar } from "./_components/Toolbar";
import { SortableHeader } from "./_components/SortableHeader";
import { InlinePrice } from "./_components/InlinePrice";
import { InlineStatus } from "./_components/InlineStatus";
import { InlineCondition } from "./_components/InlineCondition";
import { Pager } from "./_components/Pager";
import { formatRelative } from "./_components/relativeTime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const VALID_SORTS = new Set([
  "updated",
  "name",
  "price",
  "status",
  "condition",
]);

type SearchParams = {
  q?: string;
  status?: string;
  line?: string;
  brand?: string;
  series?: string;
  missing?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

type Status = "draft" | "available" | "reserved" | "sold";
type Cond = "mint_sealed" | "mint_open" | "near_mint" | "good" | "fair";

type Row = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  status: Status;
  condition: Cond;
  description: string | null;
  updated_at: string;
  product_line:
    | { name: string; slug: string; brand_id: string }
    | { name: string; slug: string; brand_id: string }[]
    | null;
  series:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
};

function getOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ProductsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const admin = createAdminClient();

  // Taxonomy for filter chips + slug -> id resolution.
  const [brandsRes, linesRes, seriesRes] = await Promise.all([
    admin.from("brands").select("id, name, slug").order("name"),
    admin
      .from("product_lines")
      .select("id, name, slug, brand_id")
      .order("name"),
    admin.from("series").select("id, name, slug").order("name"),
  ]);

  const brands = (brandsRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  const lines = (linesRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    brand_id: string;
  }>;
  const seriesAll = (seriesRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  // Slug -> id resolution for filters.
  const lineBySlug = new Map(lines.map((l) => [l.slug, l]));
  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));
  const seriesBySlug = new Map(seriesAll.map((s) => [s.slug, s]));

  const filterLine = sp.line ? lineBySlug.get(sp.line) : undefined;
  const filterBrand = sp.brand ? brandBySlug.get(sp.brand) : undefined;
  const filterSeries = sp.series ? seriesBySlug.get(sp.series) : undefined;

  // Build base query for products. Supabase composes filters on the chain.
  let query = admin
    .from("products")
    .select(
      "id, name, slug, price, currency, status, condition, description, updated_at, " +
        "product_line:product_lines!inner(name, slug, brand_id), series:series(name, slug)",
      { count: "exact" },
    );

  if (sp.q) query = query.ilike("name", `%${sp.q}%`);
  if (sp.status) query = query.eq("status", sp.status);
  if (filterLine) query = query.eq("product_line_id", filterLine.id);
  if (filterSeries) query = query.eq("series_id", filterSeries.id);
  if (filterBrand) {
    const linesUnderBrand = lines
      .filter((l) => l.brand_id === filterBrand.id)
      .map((l) => l.id);
    if (linesUnderBrand.length > 0) {
      query = query.in("product_line_id", linesUnderBrand);
    } else {
      query = query.eq("product_line_id", "00000000-0000-0000-0000-000000000000");
    }
  }
  if (sp.missing === "description") {
    query = query.or("description.is.null,description.eq.");
  } else if (sp.missing === "price") {
    query = query.eq("price", 0);
  } else if (sp.missing === "photos") {
    // Anti-join via PostgREST not native. Fetch product_ids that HAVE images,
    // then exclude. Cheap enough for ~256 rows.
    const { data: imgs } = await admin
      .from("product_images")
      .select("product_id");
    const withImg = new Set(
      (imgs ?? []).map((r) => (r as { product_id: string }).product_id),
    );
    if (withImg.size > 0) {
      query = query.not(
        "id",
        "in",
        `(${Array.from(withImg).join(",")})`,
      );
    }
  }

  // Sort.
  const sortKey = VALID_SORTS.has(sp.sort ?? "")
    ? (sp.sort as string)
    : "updated";
  const dir = sp.dir === "asc";
  const sortColumn =
    sortKey === "updated"
      ? "updated_at"
      : sortKey === "name"
        ? "name"
        : sortKey === "price"
          ? "price"
          : sortKey === "status"
            ? "status"
            : "condition";
  query = query.order(sortColumn, { ascending: dir });

  // Paginate.
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const start = page * PAGE_SIZE;
  query = query.range(start, start + PAGE_SIZE - 1);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalAll = count ?? 0;

  // Primary image per visible product. Single batched query keeps the row
  // render cheap. Falls back to first non-primary if no primary exists.
  const visibleIds = rows.map((r) => r.id);
  const primaryByProduct = new Map<string, string>();
  if (visibleIds.length > 0) {
    const { data: imgs } = await admin
      .from("product_images")
      .select("product_id, url, is_primary, sort_order")
      .in("product_id", visibleIds)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true });
    for (const i of (imgs ?? []) as Array<{
      product_id: string;
      url: string;
      is_primary: boolean;
    }>) {
      if (!primaryByProduct.has(i.product_id))
        primaryByProduct.set(i.product_id, i.url);
    }
  }

  // Total count without filters for the page title.
  const { count: totalUnfiltered } = await admin
    .from("products")
    .select("id", { count: "exact", head: true });

  const pageCount = Math.max(1, Math.ceil(totalAll / PAGE_SIZE));

  // Build base searchParams for sortable headers + pager (without page).
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") baseParams.set(k, v as string);
  }

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">
          Products{" "}
          <span className="ah-h1-count">({totalUnfiltered ?? 0})</span>
        </h1>
        <Link href="/admin/products/new" className="ah-btn ah-btn--primary">
          + New Product
        </Link>
      </div>

      <Toolbar
        resultCount={totalAll}
        lineOptions={lines.map((l) => ({ value: l.slug, label: l.name }))}
        brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        seriesOptions={seriesAll.map((s) => ({ value: s.slug, label: s.name }))}
      />

      <div className="ah-table-wrap">
        <table className="ah-table">
          <thead>
            <tr>
              <th style={{ width: 48 }}></th>
              <th>
                <SortableHeader label="Name" sortKey="name" />
              </th>
              <th>Line</th>
              <th>Series</th>
              <th style={{ textAlign: "right" }}>
                <SortableHeader label="Price" sortKey="price" />
              </th>
              <th>
                <SortableHeader label="Status" sortKey="status" />
              </th>
              <th>
                <SortableHeader label="Cond." sortKey="condition" />
              </th>
              <th>
                <SortableHeader label="Updated" sortKey="updated" />
              </th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="ah-table-empty">
                  No products match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const line = getOne(r.product_line);
                const series = getOne(r.series);
                const primaryUrl = primaryByProduct.get(r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="ah-thumb">
                        {primaryUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={primaryUrl} alt="" />
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/admin/products/${r.id}`}
                        className="ah-row-name"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td>{line?.name ?? "—"}</td>
                    <td>{series?.name ?? "—"}</td>
                    <td className="ah-cell-price">
                      <InlinePrice
                        id={r.id}
                        price={Number(r.price)}
                        currency={r.currency}
                      />
                    </td>
                    <td>
                      <InlineStatus id={r.id} status={r.status} />
                    </td>
                    <td>
                      <InlineCondition id={r.id} condition={r.condition} />
                    </td>
                    <td className="ah-cell-updated">
                      {formatRelative(r.updated_at)}
                    </td>
                    <td>
                      <div className="ah-row-actions">
                        <Link
                          href={`/products/${r.slug}`}
                          target="_blank"
                          className="ah-link"
                          title="View on storefront"
                        >
                          ↗
                        </Link>
                        <Link
                          href={`/admin/products/${r.id}`}
                          className="ah-link"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageCount={pageCount} baseParams={baseParams} />
    </div>
  );
}
