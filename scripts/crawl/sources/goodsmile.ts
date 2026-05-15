import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { fetchText } from "../http";
import { stripVersionSuffix } from "../normalise";
import type { AdapterResult, CandidateImage } from "./types";
import type { SourceAdapter } from "./types";

// Good Smile Company adapter. GSC has no usable public search API for
// the back-catalog, so we read a manual override file mapping
// storefront slugs → GSC product-page URLs. Two GSC sites are
// supported, picked by host:
//   - goodsmile.com  — the current store (JSON-LD + catch-copy + the
//     /gsc-webrevo-sdk-storage-prd/ CDN gallery)
//   - goodsmile.info — the legacy info site (no JSON-LD; a plain spec
//     <dl>, og:description catch-copy, and the /cgm/images/ CDN gallery)
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

// The per-figure POP UP PARADE description always trails into the
// generic series blurb ("POP UP PARADE is a series of figures…"). Keep
// only the part before that, strip surrounding quotes/space.
function cleanCatchCopy(raw: string): string | null {
  const text = raw
    .split(/POP UP PARADE is (?:a |the )?(?:new )?series/i)[0]!
    .replace(/\s+/g, " ")
    .replace(/^["“”\s]+|["“”\s]+$/g, "")
    .trim();
  return text.length >= 8 && text.length <= 400 ? text : null;
}

function buildResult(
  url: string,
  title: string | null,
  description: string | null,
  releaseYear: number | null,
  gallery: string[],
): AdapterResult | null {
  if (gallery.length === 0 && releaseYear == null && !description) {
    return null;
  }
  const images: CandidateImage[] = gallery.map((u, i) => ({
    url: u,
    alt: title ? `${title} ${String(i + 1).padStart(2, "0")}` : undefined,
  }));
  return {
    source: "goodsmile",
    sourceUrl: url,
    fields: {
      ...(description ? { description } : {}),
      ...(releaseYear ? { release_year: releaseYear } : {}),
    },
    images,
    confidence: 75, // first-party page, manual URL mapping
  };
}

// ---------- goodsmile.com (store) ----------

// Store gallery images live under a structured CDN path:
//   /gsc-webrevo-sdk-storage-prd/product/image/product/<YYYYMMDD>/<groupId>/<imgId>/large/<hash>.<ext>
// `groupId` is shared by every photo of one release; `imgId` orders
// them. The "recommended products" thumbnails use a shorter path
// (no `/product/<date>/` segment) so this regex excludes them.
const COM_IMAGE_RE =
  /\/gsc-webrevo-sdk-storage-prd\/product\/image\/product\/(\d{8})\/(\d+)\/(\d+)\/large\/[A-Za-z0-9]+\.(?:jpg|jpeg|png|webp)/i;

type ComImage = { url: string; date: string; group: string; order: number };

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

function parseComPage(url: string, html: string): AdapterResult | null {
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLd($);

  const all: ComImage[] = [];
  const seen = new Set<string>();
  $("img").each((_, el) => {
    let src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    const m = src.match(COM_IMAGE_RE);
    if (!m) return;
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = "https://www.goodsmile.com" + src;
    if (seen.has(src)) return;
    seen.add(src);
    all.push({ url: src, date: m[1]!, group: m[2]!, order: Number(m[3]!) });
  });

  // Keep only the hero image's group when we can identify it; otherwise
  // fall back to the most common group (avoids stray re-release thumbs).
  const heroImg = Array.isArray(jsonLd?.image)
    ? jsonLd?.image[0]
    : jsonLd?.image;
  let group = heroImg?.match(COM_IMAGE_RE)?.[2] ?? null;
  if (!group && all.length > 0) {
    const counts = new Map<string, number>();
    for (const im of all) counts.set(im.group, (counts.get(im.group) ?? 0) + 1);
    group = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  }
  const gallery = all
    .filter((im) => im.group === group)
    .sort((a, b) => a.order - b.order);

  // Release year: the YYYYMMDD segment is the CDN upload date, which
  // tracks the (re)release window closely.
  let releaseYear: number | null = null;
  if (gallery.length > 0) {
    const y = Number(gallery[0]!.date.slice(0, 4));
    if (y >= 1990 && y <= 2100) releaseYear = y;
  }

  const description = cleanCatchCopy(
    $(".js-product-info__catch-copy").first().text(),
  );
  const title = jsonLd?.name?.trim() || null;
  return buildResult(
    url,
    title,
    description,
    releaseYear,
    gallery.map((im) => im.url),
  );
}

// ---------- goodsmile.info (legacy info site) ----------

// Info-site gallery images:
//   //images.goodsmile.info/cgm/images/product/<YYYYMMDD>/<productId>/<imgId>/large/<hash>.jpg
// The page also embeds related-product images under a different
// productId, so we filter to the id taken from the override URL.
const INFO_IMAGE_RE =
  /\/cgm\/images\/product\/\d{8}\/(\d+)\/(\d+)\/large\/[A-Za-z0-9]+\.(?:jpg|jpeg|png|webp)/i;

function infoProductId(url: string): string | null {
  return url.match(/\/product\/(\d+)/)?.[1] ?? null;
}

function parseInfoPage(url: string, html: string): AdapterResult | null {
  const $ = cheerio.load(html);
  const productId = infoProductId(url);

  const seen = new Set<string>();
  const gallery: { url: string; order: number }[] = [];
  $("img").each((_, el) => {
    let src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    const m = src.match(INFO_IMAGE_RE);
    if (!m) return;
    if (productId && m[1] !== productId) return; // related-product image
    if (src.startsWith("//")) src = "https:" + src;
    if (seen.has(src)) return;
    seen.add(src);
    gallery.push({ url: src, order: Number(m[2]!) });
  });
  gallery.sort((a, b) => a.order - b.order);

  // Spec <dl>: find the "Release Date" dt/dd pair (e.g. "2022/07").
  let releaseYear: number | null = null;
  let title: string | null = null;
  $("dt").each((_, dt) => {
    const label = $(dt).text().replace(/\s+/g, " ").trim().toLowerCase();
    const value = $(dt).next("dd").text().replace(/\s+/g, " ").trim();
    if (label === "release date" && releaseYear == null) {
      const y = value.match(/(19|20)\d{2}/);
      if (y) releaseYear = Number(y[0]);
    }
    if (label === "product name" && !title) title = value;
  });

  // Catch-copy lives in og:description / meta description, ahead of the
  // generic series blurb.
  const metaDesc =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    "";
  const description = cleanCatchCopy(metaDesc);
  if (!title) {
    title = $("h1.title").first().text().trim() || null;
  }

  return buildResult(url, title, description, releaseYear, gallery.map((g) => g.url));
}

// ---------- dispatch ----------

export async function fetchBySlug(
  productSlug: string,
): Promise<AdapterResult | null> {
  const url = findOverride(productSlug);
  if (!url) return null;

  const html = await fetchText(url, { browserLike: true });
  if (!html) return null;

  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  if (host.includes("goodsmile.info")) return parseInfoPage(url, html);
  return parseComPage(url, html);
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
