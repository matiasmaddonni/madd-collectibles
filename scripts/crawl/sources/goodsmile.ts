import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { fetchText } from "../http";
import { stripVersionSuffix } from "../normalise";
import type { AdapterResult, SourceAdapter } from "./types";

// Good Smile Company adapter. Like Tamashii, GSC has no usable public
// search API for the back-catalog, so we read a manual override file
// mapping storefront slugs → GSC product-page URLs. When a slug is
// mapped, we fetch the page and pull:
//   - the figure gallery (filtered to the hero image's group id)
//   - release year (derived from the hero image's upload-date path)
//   - description (the per-figure "catch copy" tagline)
//
// Override file: scripts/crawl/cache/goodsmile-overrides.json
// Shape: { "overrides": { "<slug>": "<product url>" } }
// Empty-string URLs are inert scaffold placeholders.
//
// All mapped slugs are EXISTING storefront rows, so there is no draft
// creation here — the adapter only proposes data for admin review.

const OVERRIDES_PATH = join(
  process.cwd(),
  "scripts",
  "crawl",
  "cache",
  "goodsmile-overrides.json",
);

const SITE_ORIGIN = "https://www.goodsmile.com";

type Overrides = { overrides?: Record<string, string> };

let overridesCache: Record<string, string> | null = null;

export function loadGoodsmileOverrides(): Record<string, string> {
  if (overridesCache) return overridesCache;
  const out: Record<string, string> = {};
  if (existsSync(OVERRIDES_PATH)) {
    try {
      const parsed = JSON.parse(
        readFileSync(OVERRIDES_PATH, "utf8"),
      ) as Overrides;
      for (const [slug, url] of Object.entries(parsed.overrides ?? {})) {
        // `_comment_*` keys are section dividers; empty strings are
        // unfilled scaffold placeholders. Skip both.
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
  const overrides = loadGoodsmileOverrides();
  const stripped = stripVersionSuffix(productSlug);
  return overrides[productSlug] ?? overrides[stripped] ?? null;
}

// GSC product gallery images live under a structured CDN path:
//   /gsc-webrevo-sdk-storage-prd/product/image/product/<YYYYMMDD>/<groupId>/<imgId>/large/<hash>.<ext>
// `groupId` is shared by every photo of one release; `imgId` orders
// them. The "recommended products" thumbnails use a different,
// shorter path (no `/product/<date>/` segment) so this regex excludes
// them automatically.
const GSC_IMAGE_RE =
  /\/gsc-webrevo-sdk-storage-prd\/product\/image\/product\/(\d{8})\/(\d+)\/(\d+)\/large\/[A-Za-z0-9]+\.(?:jpg|jpeg|png|webp)/i;

type ParsedImage = { url: string; date: string; group: string; order: number };

function parseImages(html: string): ParsedImage[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: ParsedImage[] = [];
  $("img").each((_, el) => {
    let src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (!src) return;
    const m = src.match(GSC_IMAGE_RE);
    if (!m) return;
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = SITE_ORIGIN + src;
    if (seen.has(src)) return;
    seen.add(src);
    out.push({
      url: src,
      date: m[1]!,
      group: m[2]!,
      order: Number(m[3]!),
    });
  });
  return out;
}

type JsonLdProduct = {
  name?: string;
  image?: string | string[];
  description?: string;
};

function parseJsonLd($: cheerio.CheerioAPI): JsonLdProduct | null {
  let found: JsonLdProduct | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const raw = JSON.parse($(el).contents().text());
      const node = Array.isArray(raw) ? raw[0] : raw;
      if (node && node["@type"] === "Product") found = node as JsonLdProduct;
    } catch {
      // ignore malformed block
    }
  });
  return found;
}

function heroGroupId(jsonLd: JsonLdProduct | null): string | null {
  const img = Array.isArray(jsonLd?.image)
    ? jsonLd?.image[0]
    : jsonLd?.image;
  if (!img) return null;
  return img.match(GSC_IMAGE_RE)?.[2] ?? null;
}

export async function fetchBySlug(
  productSlug: string,
): Promise<AdapterResult | null> {
  const url = findOverride(productSlug);
  if (!url) return null;

  const html = await fetchText(url, { browserLike: true });
  if (!html) return null;
  const $ = cheerio.load(html);

  const jsonLd = parseJsonLd($);
  const allImages = parseImages(html);

  // Keep only the hero image's group when we can identify it; otherwise
  // fall back to the most common group on the page (avoids pulling in
  // stray re-release thumbnails).
  let group = heroGroupId(jsonLd);
  if (!group && allImages.length > 0) {
    const counts = new Map<string, number>();
    for (const im of allImages)
      counts.set(im.group, (counts.get(im.group) ?? 0) + 1);
    group = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  }
  const gallery = allImages
    .filter((im) => im.group === group)
    .sort((a, b) => a.order - b.order);

  // Release year: the YYYYMMDD segment of the gallery's image path is
  // the CDN upload date, which tracks the (re)release window closely.
  let releaseYear: number | null = null;
  if (gallery.length > 0) {
    const y = Number(gallery[0]!.date.slice(0, 4));
    if (y >= 1990 && y <= 2100) releaseYear = y;
  }

  // Description: the per-figure "catch copy" tagline is short and clean.
  // The JSON-LD description is polluted with the generic POP UP PARADE
  // series blurb + delay-notice URLs, so we don't use it.
  const catchCopy = $(".js-product-info__catch-copy")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const description =
    catchCopy.length >= 8 && catchCopy.length <= 300 ? catchCopy : null;

  if (gallery.length === 0 && releaseYear == null && !description) {
    return null;
  }

  const title = jsonLd?.name?.trim() || null;
  return {
    source: "goodsmile",
    sourceUrl: url,
    fields: {
      ...(description ? { description } : {}),
      ...(releaseYear ? { release_year: releaseYear } : {}),
    },
    images: gallery.map((im, i) => ({
      url: im.url,
      alt: title ? `${title} ${String(i + 1).padStart(2, "0")}` : undefined,
    })),
    confidence: 75, // first-party page, manual URL mapping
  };
}

export const goodsmileAdapter: SourceAdapter & {
  fetchBySlug: typeof fetchBySlug;
} = {
  name: "goodsmile",
  enabled: () => Object.keys(loadGoodsmileOverrides()).length > 0,
  // The runner dispatches slug-keyed adapters through fetchBySlug; the
  // generic name-search `fetch` is unused for this source.
  fetch: async () => null,
  fetchBySlug,
};
