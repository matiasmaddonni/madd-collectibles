import "server-only";
import { cache } from "react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type {
  ProductCondition,
  ProductStatus,
  Currency,
} from "@/lib/supabase/types";

const createClient = createServerClient;

export type CaseGradient = "gold" | "crimson" | "mixed" | "cool";

export type HomeProductCard = {
  id: string;
  slug: string;
  name: string;
  seriesName: string | null;
  lineName: string;
  caseGradient: CaseGradient;
  conditionLabel: string;
  status: ProductStatus;
  statusLabel: string;
  price: number;
  currency: Currency;
  imageUrl: string | null;
  images: string[];
};

export type ProductDetail = HomeProductCard & {
  description: string | null;
  sku: string | null;
  releaseYear: number | null;
  tags: string[];
  stockQty: number;
  productLineSlug: string;
  seriesSlug: string | null;
};

export type HomeCategory = {
  slug: string;
  name: string;
  caseGradient: CaseGradient;
  productCount: number;
  imageUrl: string | null;
  href: string;
};

const CONDITION_LABEL: Record<ProductCondition, string> = {
  mint_sealed: "Sellado",
  mint_open: "Como Nuevo",
  near_mint: "Loose",
  good: "Used",
  fair: "Detalles",
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const LINE_GRADIENT: Record<string, CaseGradient> = {
  "myth-cloth": "gold",
  "myth-cloth-ex": "crimson",
  "myth-cloth-ex-metal": "crimson",
  "sh-figuarts": "mixed",
  "figuarts-zero": "mixed",
  "popup-parade": "cool",
  "variable-action-heroes": "cool",
  otros: "cool",
};

type RelOne<T> = T | T[] | null;
type Row = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  currency: Currency;
  condition: ProductCondition;
  status: ProductStatus;
  is_featured: boolean;
  description?: string | null;
  sku?: string | null;
  release_year?: number | null;
  tags?: string[];
  stock_qty?: number;
  product_line: RelOne<{ slug: string; name: string }>;
  series: RelOne<{ slug: string; name: string }>;
  images: RelOne<{ url: string; is_primary: boolean; sort_order: number }>;
};

function asArray<T>(v: RelOne<T>): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}
function asOne<T>(v: RelOne<T>): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toCard(row: Row): HomeProductCard {
  const images = asArray(row.images);
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const urls = sorted.map((i) => i.url);
  const productLine = asOne(row.product_line);
  const series = asOne(row.series);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    seriesName: series?.name ?? null,
    lineName: productLine?.name ?? "—",
    caseGradient:
      (productLine && LINE_GRADIENT[productLine.slug]) ?? "cool",
    conditionLabel: CONDITION_LABEL[row.condition],
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    price: Number(row.price),
    currency: row.currency,
    imageUrl: urls[0] ?? null,
    images: urls,
  };
}

const SELECT = `
  id, slug, name, price, currency, condition, status, is_featured, created_at,
  product_line:product_lines!inner ( slug, name ),
  series:series ( slug, name ),
  images:product_images ( url, is_primary, sort_order )
`;

export async function getFeaturedProducts(
  limit = 4,
): Promise<HomeProductCard[]> {
  const supabase = await createClient();

  const featuredRes = await supabase
    .from("products")
    .select(SELECT)
    .eq("status", "available")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  const featured = (featuredRes.data ?? []) as unknown as Row[];
  if (featured.length >= limit) return featured.map(toCard);

  const remaining = limit - featured.length;
  const seen = new Set(featured.map((r) => r.id));

  const newestRes = await supabase
    .from("products")
    .select(SELECT)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(remaining + featured.length);

  const newest = (newestRes.data ?? []) as unknown as Row[];
  const fill = newest.filter((r) => !seen.has(r.id)).slice(0, remaining);

  return [...featured, ...fill].map(toCard);
}

export async function getHeroPreviewProducts(
  limit = 3,
  excludeIds: string[] = [],
): Promise<HomeProductCard[]> {
  const supabase = await createClient();

  let q = supabase
    .from("products")
    .select(SELECT)
    .eq("status", "available")
    .order("updated_at", { ascending: false })
    .limit(limit + excludeIds.length);

  if (excludeIds.length > 0) {
    q = q.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  return rows.slice(0, limit).map(toCard);
}

const DETAIL_SELECT = `
  id, slug, name, price, currency, condition, status, is_featured, created_at,
  description, sku, release_year, tags, stock_qty,
  product_line:product_lines!inner ( slug, name ),
  series:series ( slug, name ),
  images:product_images ( url, is_primary, sort_order )
`;

function toDetail(row: Row): ProductDetail {
  const base = toCard(row);
  const productLine = asOne(row.product_line);
  const series = asOne(row.series);
  return {
    ...base,
    description: row.description ?? null,
    sku: row.sku ?? null,
    releaseYear: row.release_year ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    stockQty: typeof row.stock_qty === "number" ? row.stock_qty : 0,
    productLineSlug: productLine?.slug ?? "",
    seriesSlug: series?.slug ?? null,
  };
}

export type CatalogFilters = {
  lineSlugs?: string[];
  excludeLineSlugs?: string[];
  conditions?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  sort?:
    | "newest"
    | "oldest"
    | "price-asc"
    | "price-desc"
    | "name-asc"
    | "name-desc";
  page?: number;
  perPage?: number;
};

const SLUG_RE = /^[a-z0-9-]+$/;
function safeSlugs(slugs: string[] | undefined): string[] {
  if (!slugs) return [];
  return slugs.filter((s) => SLUG_RE.test(s));
}

export type CatalogResult = {
  items: HomeProductCard[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export async function getCatalogProducts(
  f: CatalogFilters = {},
): Promise<CatalogResult> {
  const perPage = Math.max(1, Math.min(48, f.perPage ?? 12));
  const page = Math.max(1, f.page ?? 1);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const supabase = await createClient();

  let q = supabase
    .from("products")
    .select(SELECT, { count: "exact" });

  const includeLines = safeSlugs(f.lineSlugs);
  if (includeLines.length > 0) {
    q = q.in("product_lines.slug", includeLines);
  }
  const excludeLines = safeSlugs(f.excludeLineSlugs);
  if (excludeLines.length > 0) {
    q = q.not(
      "product_lines.slug",
      "in",
      `(${excludeLines.join(",")})`,
    );
  }
  if (f.conditions && f.conditions.length > 0) {
    q = q.in("condition", f.conditions);
  }
  if (typeof f.minPrice === "number" && Number.isFinite(f.minPrice)) {
    q = q.gte("price", f.minPrice);
  }
  if (typeof f.maxPrice === "number" && Number.isFinite(f.maxPrice)) {
    q = q.lte("price", f.maxPrice);
  }
  if (f.q && f.q.trim().length > 0) {
    const term = f.q.trim().replace(/[%,]/g, " ");
    q = q.ilike("name", `%${term}%`);
  }

  switch (f.sort) {
    case "price-asc":
      q = q.order("price", { ascending: true });
      break;
    case "price-desc":
      q = q.order("price", { ascending: false });
      break;
    case "name-asc":
      q = q.order("name", { ascending: true });
      break;
    case "name-desc":
      q = q.order("name", { ascending: false });
      break;
    case "oldest":
      q = q.order("created_at", { ascending: true });
      break;
    case "newest":
    default:
      q = q.order("created_at", { ascending: false });
      break;
  }

  q = q.range(from, to);

  const { data, count } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  return {
    items: rows.map(toCard),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getCatalogFacets(): Promise<{
  lines: { slug: string; name: string; count: number }[];
  conditions: { value: ProductCondition; label: string; count: number }[];
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("condition, product_line:product_lines!inner ( slug, name )");
  const rows = (data ?? []) as unknown as Array<{
    condition: ProductCondition;
    product_line: RelOne<{ slug: string; name: string }>;
  }>;

  const lineMap = new Map<string, { slug: string; name: string; count: number }>();
  const condMap = new Map<ProductCondition, number>();
  for (const r of rows) {
    const pl = asOne(r.product_line);
    if (pl) {
      const cur = lineMap.get(pl.slug);
      if (cur) cur.count++;
      else lineMap.set(pl.slug, { slug: pl.slug, name: pl.name, count: 1 });
    }
    condMap.set(r.condition, (condMap.get(r.condition) ?? 0) + 1);
  }

  const lines = [...lineMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const conditions = [...condMap.entries()]
    .map(([value, count]) => ({
      value,
      label: CONDITION_LABEL[value],
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { lines, conditions };
}

export async function getRelatedProducts(
  productLineSlug: string,
  excludeId: string,
  limit = 4,
): Promise<HomeProductCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT)
    .eq("status", "available")
    .eq("product_lines.slug", productLineSlug)
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as Row[];
  return rows.map(toCard);
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return toDetail(data as unknown as Row);
}

type SlugId = { id: string; slug: string };

const lookupRefs = cache(async () => {
  const supabase = await createClient();
  const [linesRes, seriesRes] = await Promise.all([
    supabase.from("product_lines").select("id, slug"),
    supabase.from("series").select("id, slug"),
  ]);
  const lineIdBySlug: Record<string, string> = {};
  for (const l of (linesRes.data ?? []) as SlugId[]) lineIdBySlug[l.slug] = l.id;
  const seriesIdBySlug: Record<string, string> = {};
  for (const s of (seriesRes.data ?? []) as SlugId[]) seriesIdBySlug[s.slug] = s.id;
  return { lineIdBySlug, seriesIdBySlug };
});

async function countByLineIds(lineIds: string[]) {
  if (lineIds.length === 0) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .in("product_line_id", lineIds);
  return count ?? 0;
}

const CATEGORY_IMAGE_BASE =
  "https://idkikvkdijmifaskobeh.supabase.co/storage/v1/object/public/category-images";

const CATEGORY_DEFS: Array<{
  slug: string;
  name: string;
  caseGradient: CaseGradient;
  lineSlugs: string[];
  matchTokens: string[];
}> = [
  {
    slug: "myth-cloth",
    name: "Myth Cloth",
    caseGradient: "gold",
    lineSlugs: ["myth-cloth", "myth-cloth-ex", "myth-cloth-ex-metal"],
    matchTokens: ["myth-cloth", "myth_cloth", "mythcloth"],
  },
  {
    slug: "sh-figuarts",
    name: "S.H.Figuarts",
    caseGradient: "crimson",
    lineSlugs: ["sh-figuarts", "figuarts-zero"],
    matchTokens: ["sh-figuarts", "shfiguarts", "sh_figuarts", "figuarts"],
  },
  {
    slug: "popup-parade",
    name: "Pop Up Parade",
    caseGradient: "mixed",
    lineSlugs: ["popup-parade"],
    matchTokens: ["popup-parade", "pop-up-parade", "popupparade", "pop_up_parade"],
  },
  {
    slug: "otros",
    name: "Otros",
    caseGradient: "cool",
    lineSlugs: ["variable-action-heroes", "otros"],
    matchTokens: ["otros", "varios"],
  },
];

const listCategoryImages = cache(async (): Promise<string[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return [];
  const admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin.storage
    .from("category-images")
    .list("", { limit: 100 });
  return (data ?? []).map((f) => f.name);
});

function findCategoryImage(
  files: string[],
  tokens: string[],
): string | null {
  const lower = files.map((f) => ({ name: f, l: f.toLowerCase() }));
  for (const t of tokens) {
    const tl = t.toLowerCase();
    const hit = lower.find((f) => f.l.includes(tl));
    if (hit) return hit.name;
  }
  return null;
}

function buildCategoryHref(slug: string): string {
  if (slug === "otros") {
    const exclude = CATEGORY_DEFS.filter((d) => d.slug !== "otros").flatMap(
      (d) => d.lineSlugs,
    );
    const unique = [...new Set(exclude)];
    if (unique.length === 0) return "/catalogo";
    return `/catalogo?excluir=${encodeURIComponent(unique.join(","))}`;
  }
  const def = CATEGORY_DEFS.find((d) => d.slug === slug);
  if (!def || def.lineSlugs.length === 0) return "/catalogo";
  return `/catalogo?linea=${encodeURIComponent(def.lineSlugs.join(","))}`;
}

export async function getHomeCategories(): Promise<HomeCategory[]> {
  const [{ lineIdBySlug }, files] = await Promise.all([
    lookupRefs(),
    listCategoryImages(),
  ]);

  const results = await Promise.all(
    CATEGORY_DEFS.map(async (def) => {
      const ids = def.lineSlugs
        .map((s) => lineIdBySlug[s])
        .filter((id): id is string => Boolean(id));
      const count = await countByLineIds(ids);
      const matchedFile = findCategoryImage(files, def.matchTokens);
      return {
        slug: def.slug,
        name: def.name,
        caseGradient: def.caseGradient,
        productCount: count,
        imageUrl: matchedFile
          ? `${CATEGORY_IMAGE_BASE}/${encodeURIComponent(matchedFile)}`
          : null,
        href: buildCategoryHref(def.slug),
      };
    }),
  );

  return results;
}
