import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchJson } from "../http";
import { stripVersionSuffix } from "../normalise";
import type { AdapterResult, SourceAdapter } from "./types";

// MegaHouse adapter. MegaHouse's official English storefront,
// en.megahobby.jp, runs on Shopify — which exposes a clean JSON
// document for every product at `<product-url>.json`. We read a manual
// override file mapping storefront slugs → en.megahobby.jp product
// URLs, then hit the `.json` endpoint for structured data:
//   - body_html      → English description
//   - tags (YYYY-MM) → release year
//   - images[].src   → figure gallery (Shopify CDN)
//
// Override file: scripts/crawl/cache/megahouse-overrides.json
// Shape: { "overrides": { "<slug>": "<en.megahobby.jp product url>" } }
// Empty-string URLs are inert scaffold placeholders.
//
// All mapped slugs are EXISTING storefront rows, so there is no draft
// creation here — the adapter only proposes data for admin review.

const OVERRIDES_PATH = join(
  process.cwd(),
  "scripts",
  "crawl",
  "cache",
  "megahouse-overrides.json",
);

type Overrides = { overrides?: Record<string, string> };

let overridesCache: Record<string, string> | null = null;

export function loadMegahouseOverrides(): Record<string, string> {
  if (overridesCache) return overridesCache;
  const out: Record<string, string> = {};
  if (existsSync(OVERRIDES_PATH)) {
    try {
      const parsed = JSON.parse(
        readFileSync(OVERRIDES_PATH, "utf8"),
      ) as Overrides;
      for (const [slug, url] of Object.entries(parsed.overrides ?? {})) {
        if (slug.startsWith("_")) continue;
        const trimmed = typeof url === "string" ? url.trim() : "";
        if (trimmed) out[slug] = trimmed;
      }
    } catch {
      // fall through to empty
    }
  }
  overridesCache = out;
  return overridesCache;
}

function findOverride(productSlug: string): string | null {
  const overrides = loadMegahouseOverrides();
  const stripped = stripVersionSuffix(productSlug);
  return overrides[productSlug] ?? overrides[stripped] ?? null;
}

// Build the Shopify structured-product URL from a product page URL.
// Shopify serves product JSON at the canonical `/products/<handle>.json`
// path; collection-scoped URLs like
// `/collections/<c>/products/<handle>` must be normalised down to that
// canonical form (the collection-scoped `.json` path 404s).
function toJsonUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    const m = u.pathname.match(/\/products\/([^/]+?)(?:\.json)?\/*$/);
    if (!m) return null;
    return `${u.origin}/products/${m[1]}.json`;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Keep the description to a couple of sentences — trim at a sentence
// boundary near the cap so we don't cut mid-word.
function trimDescription(text: string, cap = 500): string {
  if (text.length <= cap) return text;
  const slice = text.slice(0, cap);
  const lastStop = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  return lastStop > 120 ? slice.slice(0, lastStop + 1) : slice.trim();
}

// Release year lives in the Shopify tag list as a "YYYY-MM" entry
// (e.g. "2022-11"). published_at/created_at track the store listing
// date, not the figure release, so we don't use them.
function releaseYearFromTags(tags: unknown): number | null {
  const list = Array.isArray(tags)
    ? (tags as string[])
    : typeof tags === "string"
      ? tags.split(",")
      : [];
  for (const t of list) {
    const m = t.trim().match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
    if (m) return Number(m[1]);
  }
  return null;
}

type ShopifyImage = { src?: string; position?: number };
type ShopifyProduct = {
  title?: string;
  body_html?: string;
  tags?: string | string[];
  images?: ShopifyImage[];
};

export async function fetchBySlug(
  productSlug: string,
): Promise<AdapterResult | null> {
  const pageUrl = findOverride(productSlug);
  if (!pageUrl) return null;
  const jsonUrl = toJsonUrl(pageUrl);
  if (!jsonUrl) return null;

  const doc = await fetchJson<{ product?: ShopifyProduct }>(jsonUrl, {
    browserLike: true,
  });
  const product = doc?.product;
  if (!product) return null;

  const title = product.title?.trim() || null;

  const descriptionRaw = product.body_html
    ? htmlToText(product.body_html)
    : "";
  const description =
    descriptionRaw.length >= 40 ? trimDescription(descriptionRaw) : null;

  const releaseYear = releaseYearFromTags(product.tags);

  const images = (product.images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((im) => im.src)
    .filter((src): src is string => Boolean(src));

  if (images.length === 0 && releaseYear == null && !description) {
    return null;
  }

  return {
    source: "megahouse",
    sourceUrl: pageUrl,
    fields: {
      ...(description ? { description } : {}),
      ...(releaseYear ? { release_year: releaseYear } : {}),
    },
    images: images.map((url, i) => ({
      url,
      alt: title ? `${title} ${String(i + 1).padStart(2, "0")}` : undefined,
    })),
    confidence: 85, // official English storefront, manual URL mapping
  };
}

export const megahouseAdapter: SourceAdapter & {
  fetchBySlug: typeof fetchBySlug;
} = {
  name: "megahouse",
  enabled: () => Object.keys(loadMegahouseOverrides()).length > 0,
  fetch: async () => null,
  fetchBySlug,
};
