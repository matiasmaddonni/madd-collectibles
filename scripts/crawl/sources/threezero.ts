import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { fetchText } from "../http";
import { stripVersionSuffix } from "../normalise";
import type { AdapterResult, SourceAdapter } from "./types";

// Three Zero (threezerohk.com) adapter. Three Zero's storefront is a
// custom Magento-ish site that ships JSON-LD Product data inside a
// <script type="application/ld+json"> block on every product page, plus
// og: meta tags for the title/description/primary image. We parse the
// JSON-LD when present and fall back to og: + a generic gallery sweep.
//
// Override file: scripts/crawl/cache/threezero-overrides.json
// Shape (two forms):
//   "<slug>": "<threezero product url>"
//   "<slug>": { url, line, name?, series? }
//
// The object form opts the slug into draft creation (status='draft' row
// inserted by the runner when the slug doesn't exist yet).

const OVERRIDES_PATH = join(
  process.cwd(),
  "scripts",
  "crawl",
  "cache",
  "threezero-overrides.json",
);

export type ThreezeroOverride = {
  url: string;
  line?: string;
  name?: string;
  series?: string;
};

type RawOverrides = {
  overrides?: Record<string, string | Partial<ThreezeroOverride>>;
  _batches?: Record<string, string[]>;
  _batch_series?: Record<string, string>;
};

let overridesCache: Record<string, ThreezeroOverride> | null = null;
let batchesCache: Record<string, string[]> | null = null;
let batchSeriesCache: Record<string, string> | null = null;

function readFile(): RawOverrides {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as RawOverrides;
  } catch {
    return {};
  }
}

export function loadThreezeroOverrides(): Record<string, ThreezeroOverride> {
  if (overridesCache) return overridesCache;
  const parsed = readFile();
  const out: Record<string, ThreezeroOverride> = {};
  for (const [slug, value] of Object.entries(parsed.overrides ?? {})) {
    if (slug.startsWith("_")) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      out[slug] = { url: trimmed };
    } else if (value && typeof value === "object") {
      const url = typeof value.url === "string" ? value.url.trim() : "";
      if (!url) continue;
      out[slug] = {
        url,
        line: value.line,
        name: value.name,
        series: value.series,
      };
    }
  }
  overridesCache = out;
  return overridesCache;
}

export function loadThreezeroBatches(): Record<string, string[]> {
  if (batchesCache) return batchesCache;
  batchesCache = readFile()._batches ?? {};
  return batchesCache;
}

export function threezeroSlugsForBatch(batch: string): string[] {
  return loadThreezeroBatches()[batch] ?? [];
}

export function threezeroSeriesForOverride(slug: string): string | null {
  const ov = loadThreezeroOverrides()[slug];
  if (ov?.series) return ov.series;
  if (!batchSeriesCache) batchSeriesCache = readFile()._batch_series ?? {};
  const batches = loadThreezeroBatches();
  for (const [batch, slugs] of Object.entries(batches)) {
    if (slugs.includes(slug)) return batchSeriesCache[batch] ?? null;
  }
  return null;
}

function findOverride(productSlug: string): ThreezeroOverride | null {
  const overrides = loadThreezeroOverrides();
  const stripped = stripVersionSuffix(productSlug);
  return overrides[productSlug] ?? overrides[stripped] ?? null;
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

// JSON-LD Product object — Three Zero embeds one per product page. Each
// site flavours the shape slightly; we accept the common variants.
type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  description?: string;
  sku?: string;
  image?: string | string[];
  brand?: { name?: string } | string;
  releaseDate?: string;
};

function findJsonLdProduct($: cheerio.CheerioAPI): JsonLdProduct | null {
  let hit: JsonLdProduct | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (hit) return;
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as JsonLdProduct | JsonLdProduct[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of list) {
        if (obj && obj["@type"] === "Product") {
          hit = obj;
          return;
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  });
  return hit;
}

// SKU prefix `3zNNNN` lives in every threezero URL slug — pull it out so
// the proposal can suggest a structured SKU for the product row.
function skuFromUrl(url: string): string | null {
  const m = url.match(/\/(3z\d+)-/i);
  return m ? m[1].toUpperCase() : null;
}

// Year hint — JSON-LD's releaseDate is most reliable; fall back to a
// description sweep for a 4-digit year between 2000 and 2099.
function releaseYearFromHint(hint: string | undefined): number | null {
  if (!hint) return null;
  const m = hint.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

function collectGalleryImages(
  $: cheerio.CheerioAPI,
  jsonLdImages: string[],
): string[] {
  const set = new Set<string>(jsonLdImages);
  // Sweep <img> + <source> for product-shop CDN URLs. Skip obvious
  // chrome/logo/banner assets.
  const SKIP_RE = /(logo|favicon|sprite|placeholder|banner|hero|thumb_nav)/i;
  $("img, source").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("srcset")?.split(",")[0]?.trim().split(" ")[0];
    if (!src) return;
    let u = src.trim();
    if (u.startsWith("//")) u = "https:" + u;
    if (!u.startsWith("http")) return;
    if (SKIP_RE.test(u)) return;
    // Keep only Three Zero / common CDN hosts where product photos live.
    if (
      !/threezerohk\.com|cloudfront\.net|amazonaws\.com|akamaized\.net|shopify/i.test(
        u,
      )
    ) {
      return;
    }
    set.add(u);
  });
  return Array.from(set);
}

export async function fetchBySlug(
  productSlug: string,
): Promise<AdapterResult | null> {
  const override = findOverride(productSlug);
  if (!override) return null;
  const url = override.url;

  const html = await fetchText(url, { browserLike: true });
  if (!html) return null;
  const $ = cheerio.load(html);

  const ld = findJsonLdProduct($);

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();
  const ogImg = $('meta[property="og:image"]').attr("content")?.trim();

  const title = (ld?.name ?? ogTitle ?? $("h1").first().text().trim()) || null;

  const descRaw = (
    ld?.description ?? ogDesc ?? ""
  ).toString();
  const descClean = descRaw.includes("<")
    ? htmlToText(descRaw)
    : descRaw.trim();
  const description = descClean.length >= 40 ? trimDescription(descClean) : null;

  const sku = ld?.sku?.trim() || skuFromUrl(url);

  const ldImages: string[] = Array.isArray(ld?.image)
    ? (ld!.image as string[])
    : typeof ld?.image === "string"
      ? [ld!.image as string]
      : ogImg
        ? [ogImg]
        : [];
  const images = collectGalleryImages($, ldImages);

  const releaseYear =
    releaseYearFromHint(ld?.releaseDate) ?? releaseYearFromHint(descClean);

  if (!description && images.length === 0 && !sku && !releaseYear) {
    return null;
  }

  return {
    source: "threezero",
    sourceUrl: url,
    fields: {
      ...(description ? { description } : {}),
      ...(sku ? { sku } : {}),
      ...(releaseYear ? { release_year: releaseYear } : {}),
    },
    images: images.map((u, i) => ({
      url: u,
      alt: title ? `${title} ${String(i + 1).padStart(2, "0")}` : undefined,
    })),
    confidence: 90,
  };
}

export const threezeroAdapter: SourceAdapter & {
  fetchBySlug: typeof fetchBySlug;
} = {
  name: "threezero",
  enabled: () => Object.keys(loadThreezeroOverrides()).length > 0,
  fetch: async () => null,
  fetchBySlug,
};
