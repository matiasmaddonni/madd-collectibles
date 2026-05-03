import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  ProductCondition,
  ProductStatus,
  Currency,
} from "@/lib/supabase/types";

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
};

export type HomeCategory = {
  slug: string;
  name: string;
  caseGradient: CaseGradient;
  productCount: number;
  imageUrl: string | null;
};

const CONDITION_LABEL: Record<ProductCondition, string> = {
  mint_sealed: "MISB",
  mint_open: "Open Box",
  near_mint: "Loose",
  good: "Used",
  fair: "Used",
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
  product_line: RelOne<{ slug: string; name: string }>;
  series: RelOne<{ slug: string; name: string }>;
  images: RelOne<{ url: string; is_primary: boolean }>;
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
  const primary = images.find((i) => i.is_primary) ?? images[0] ?? null;
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
    imageUrl: primary?.url ?? null,
  };
}

const SELECT = `
  id, slug, name, price, currency, condition, status, created_at,
  product_line:product_lines!inner ( slug, name ),
  series:series ( slug, name ),
  images:product_images ( url, is_primary )
`;

export async function getFeaturedProducts(
  limit = 4,
): Promise<HomeProductCard[]> {
  const supabase = await createClient();

  const withImages = await supabase
    .from("products")
    .select(SELECT)
    .eq("status", "available")
    .not("product_images", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  const rows = (withImages.data ?? []) as unknown as Row[];
  const filtered = rows.filter((r) => asArray(r.images).length > 0).slice(0, limit);

  if (filtered.length >= limit) return filtered.map(toCard);

  const fallback = await supabase
    .from("products")
    .select(SELECT)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(limit);

  const fbRows = (fallback.data ?? []) as unknown as Row[];
  const seen = new Set(filtered.map((r) => r.id));
  const merged = [
    ...filtered,
    ...fbRows.filter((r) => !seen.has(r.id)),
  ].slice(0, limit);
  return merged.map(toCard);
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
    .order("created_at", { ascending: false })
    .limit(limit + excludeIds.length + 4);

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
  imageFile: string;
}> = [
  {
    slug: "myth-cloth",
    name: "Myth Cloth",
    caseGradient: "gold",
    lineSlugs: ["myth-cloth", "myth-cloth-ex", "myth-cloth-ex-metal"],
    imageFile: "myth-cloth.jpg",
  },
  {
    slug: "sh-figuarts",
    name: "S.H.Figuarts",
    caseGradient: "crimson",
    lineSlugs: ["sh-figuarts", "figuarts-zero"],
    imageFile: "sh-figuarts.jpg",
  },
  {
    slug: "popup-parade",
    name: "Pop Up Parade",
    caseGradient: "mixed",
    lineSlugs: ["popup-parade"],
    imageFile: "popup-parade.jpg",
  },
  {
    slug: "otros",
    name: "Otros",
    caseGradient: "cool",
    lineSlugs: ["variable-action-heroes", "otros"],
    imageFile: "otros.jpg",
  },
];

async function categoryImageExists(file: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("category-images")
    .list("", { search: file });
  return Boolean(data?.some((f) => f.name === file));
}

export async function getHomeCategories(): Promise<HomeCategory[]> {
  const { lineIdBySlug } = await lookupRefs();

  const results = await Promise.all(
    CATEGORY_DEFS.map(async (def) => {
      const ids = def.lineSlugs
        .map((s) => lineIdBySlug[s])
        .filter((id): id is string => Boolean(id));
      const [count, hasImage] = await Promise.all([
        countByLineIds(ids),
        categoryImageExists(def.imageFile),
      ]);
      return {
        slug: def.slug,
        name: def.name,
        caseGradient: def.caseGradient,
        productCount: count,
        imageUrl: hasImage ? `${CATEGORY_IMAGE_BASE}/${def.imageFile}` : null,
      };
    }),
  );

  return results;
}
