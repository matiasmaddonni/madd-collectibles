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

export type HomeCategory = {
  slug: string;
  name: string;
  caseGradient: CaseGradient;
  productCount: number;
  imageUrl: string | null;
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
      };
    }),
  );

  return results;
}
