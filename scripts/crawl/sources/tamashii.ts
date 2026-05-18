import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { fetchText } from "../http";
import { stripVersionSuffix } from "../normalise";
import type { AdapterInput, AdapterResult, SourceAdapter } from "./types";

// Tamashii Web has no usable server-side search and its brand catalog
// only surfaces the ~7 most-recent items, so we can't auto-discover items
// for the back-catalog. Instead, we read a manual override file mapping
// storefront slugs → Tamashii item IDs. When a slug is mapped, we fetch
// the detail page and pull the full image gallery (8-12 high-res photos)
// + release date + EN title.
//
// Override file: scripts/crawl/cache/tamashii-overrides.json
//
// Two override shapes:
//   "<slug>": "12345"                          — existing product
//   "<slug>": { "id": "12345",                 — new draft product
//               "line": "myth-cloth-ex",       —   (required for new)
//               "name": "Optional override" }  —   (optional)
//
// When the slug doesn't exist in `products` yet, the runner creates a
// `status='draft'` row (hidden from storefront) using `line` + name
// from Tamashii. Existing slugs ignore the line/name fields.

const OVERRIDES_PATH = join(
  process.cwd(),
  "scripts",
  "crawl",
  "cache",
  "tamashii-overrides.json",
);

export type TamashiiOverride = {
  id: string;
  line?: string;
  name?: string;
  series?: string;
};

type RawOverrideValue =
  | string
  | number
  | {
      id?: string | number;
      line?: string;
      name?: string;
      series?: string;
    };

type Overrides = {
  overrides?: Record<string, RawOverrideValue>;
  _batches?: Record<string, string[]>;
  _batch_series?: Record<string, string>;
};

let overridesCache: Record<string, TamashiiOverride> | null = null;
let batchesCache: Record<string, string[]> | null = null;
let batchSeriesCache: Record<string, string> | null = null;
let slugToBatchCache: Record<string, string> | null = null;

function readFile(): Overrides {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as Overrides;
  } catch {
    return {};
  }
}

export function loadOverrides(): Record<string, TamashiiOverride> {
  if (overridesCache) return overridesCache;
  const parsed = readFile();
  const out: Record<string, TamashiiOverride> = {};
  for (const [slug, value] of Object.entries(parsed.overrides ?? {})) {
    // `_comment_*` keys are visual section separators in the JSON file;
    // they aren't real overrides. Skip them so they don't churn the DB.
    if (slug.startsWith("_")) continue;
    if (typeof value === "string" || typeof value === "number") {
      // Empty-string IDs are scaffold placeholders: a slug has been
      // added to the file but the Tamashii item ID hasn't been filled
      // in yet. Treat as inert until the ID is supplied.
      const id = String(value).trim();
      if (id) out[slug] = { id };
    } else if (value && typeof value === "object" && value.id != null) {
      const id = String(value.id).trim();
      if (!id) continue;
      out[slug] = {
        id,
        line: value.line ? String(value.line) : undefined,
        name: value.name ? String(value.name) : undefined,
        series: value.series ? String(value.series) : undefined,
      };
    }
  }
  overridesCache = out;
  return overridesCache;
}

// Returns `_batches` from the JSON file: a map of batch label → list of
// slugs. Used by the CLI's `--batch=<name>` filter to target a subset
// of overrides in one run. Each slug must also appear in `overrides`.
export function loadBatches(): Record<string, string[]> {
  if (batchesCache) return batchesCache;
  const parsed = readFile();
  batchesCache = parsed._batches ?? {};
  return batchesCache;
}

export function slugsForBatch(batch: string): string[] {
  const batches = loadBatches();
  return batches[batch] ?? [];
}

function loadBatchSeries(): Record<string, string> {
  if (batchSeriesCache) return batchSeriesCache;
  const parsed = readFile();
  batchSeriesCache = parsed._batch_series ?? {};
  return batchSeriesCache;
}

function loadSlugToBatch(): Record<string, string> {
  if (slugToBatchCache) return slugToBatchCache;
  const batches = loadBatches();
  const m: Record<string, string> = {};
  for (const [batch, slugs] of Object.entries(batches)) {
    for (const slug of slugs) m[slug] = batch;
  }
  slugToBatchCache = m;
  return slugToBatchCache;
}

// Resolves the series NAME for a given override slug, in priority order:
//   1. per-override `series` field (object form)
//   2. `_batch_series[<batch the slug belongs to>]`
//   3. null  (no series)
// The runner finds-or-creates a row in `series` matching
// (product_line_id, name) and uses its id when inserting drafts.
export function seriesForOverride(slug: string): string | null {
  const overrides = loadOverrides();
  const own = overrides[slug]?.series;
  if (own) return own;
  const batch = loadSlugToBatch()[slug];
  if (!batch) return null;
  return loadBatchSeries()[batch] ?? null;
}

// Modern listings: item_<10digit>_<hash>_<NN>.jpg.
// Legacy listings (pre-2015 IDs): item_<10digit>_<NN>.jpg — no hash.
// Capture the trailing sequence number for both shapes so the gallery
// from an old listing (e.g. Wyvern Rhadamanthys, id 384) is found.
const ITEM_IMAGE_RE =
  /\/images\/item\/item_\d{6,}(?:_[A-Za-z0-9]+)?_(\d+)\.(?:jpg|jpeg|png|webp)/i;

function extractGallery(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $("img").each((_, el) => {
    let src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (!src) return;
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) src = "https://tamashiiweb.com" + src;
    if (!ITEM_IMAGE_RE.test(src)) return;
    seen.add(src);
  });
  // Order by trailing _NN.jpg suffix so the hero (_01) comes first.
  const ordered = [...seen].sort((a, b) => {
    const na = Number(a.match(ITEM_IMAGE_RE)?.[1] ?? "999");
    const nb = Number(b.match(ITEM_IMAGE_RE)?.[1] ?? "999");
    return na - nb;
  });
  return ordered;
}

type SpecRow = { label: string; value: string };

function parseSpecRows($: cheerio.CheerioAPI): SpecRow[] {
  const rows: SpecRow[] = [];
  $("table tr").each((_, row) => {
    const $row = $(row);
    const th = $row.find("th").text().replace(/\s+/g, " ").trim();
    const td = $row.find("td").text().replace(/\s+/g, " ").trim();
    if (th && td) rows.push({ label: th, value: td });
  });
  $("dl").each((_, dl) => {
    $(dl)
      .find("dt")
      .each((_, dt) => {
        const k = $(dt).text().replace(/\s+/g, " ").trim();
        const v = $(dt).next("dd").text().replace(/\s+/g, " ").trim();
        if (k && v) rows.push({ label: k, value: v });
      });
  });
  return rows;
}

function findSpec(rows: SpecRow[], ...needles: string[]): string | null {
  for (const r of rows) {
    const lo = r.label.toLowerCase();
    if (needles.some((n) => lo.includes(n))) return r.value;
  }
  return null;
}

function parseReleaseYear(rows: SpecRow[]): number | null {
  const raw = findSpec(
    rows,
    "release date",
    "発売日",
    "fecha de lanzamiento",
    "fecha de venta",
  );
  if (!raw) return null;
  const m = raw.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

const EN_MONTH_TO_ES: Record<string, string> = {
  january: "enero",
  february: "febrero",
  march: "marzo",
  april: "abril",
  may: "mayo",
  june: "junio",
  july: "julio",
  august: "agosto",
  september: "septiembre",
  october: "octubre",
  november: "noviembre",
  december: "diciembre",
};

function spanishReleaseDate(rawDate: string | null): string | null {
  if (!rawDate) return null;
  // Accept "June 2022", "January 28, 2022", "June, 2022".
  const yearMatch = rawDate.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const year = yearMatch[0];
  const monthMatch = rawDate.toLowerCase().match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
  );
  if (!monthMatch) return year;
  return `${EN_MONTH_TO_ES[monthMatch[1]]} ${year}`;
}

// (parsePriceYen removed — yen retail price omitted from the generated
// description per editorial preference. Admin sets storefront price
// separately from the inline price form / Edit product page.)

function buildSpecDescription(rows: SpecRow[]): string | null {
  const release = spanishReleaseDate(
    findSpec(rows, "release date", "発売日"),
  );
  const saleType = findSpec(rows, "type of sale", "販売");
  const exclusive = saleType
    ? /web\s*shop|exclusive|限定|tamashii\s*web/i.test(saleType)
    : false;

  const parts: string[] = [];
  if (exclusive) parts.push("Edición exclusiva de Tamashii Web Shop");
  else if (saleType) parts.push("Distribución general");

  if (release) parts.push(`Lanzamiento: ${release}`);

  if (parts.length === 0) return null;
  return parts.join(". ") + ".";
}

function parseTitle($: cheerio.CheerioAPI): string | null {
  const t = $("title").first().text().split("|")[0]?.trim();
  if (t && t.length > 3) return t;
  return null;
}

async function fetchAdapter(
  input: AdapterInput,
): Promise<AdapterResult | null> {
  const overrides = loadOverrides();
  const slug =
    Object.keys(overrides).find((s) => s.toLowerCase() === input.name.toLowerCase()) ??
    null;
  // The runner doesn't pass `slug`, but a slug-keyed override is the
  // expected pattern. We let the caller plug in either name OR slug; the
  // runner is updated to send slug.
  void slug;
  return null;
}

export function findOverride(productSlug: string): TamashiiOverride | null {
  const overrides = loadOverrides();
  const stripped = stripVersionSuffix(productSlug);
  return overrides[productSlug] ?? overrides[stripped] ?? null;
}

// Direct-fetch helper used by the runner during draft creation, so the
// draft row can be seeded with the Tamashii title before the proposal
// loop kicks in. Returns `null` if Tamashii has no page for the ID or
// the request fails.
export async function fetchTamashiiBasics(
  itemId: string,
): Promise<{ title: string | null } | null> {
  const url = `https://tamashiiweb.com/item/${itemId}/?wovn=en`;
  const html = await fetchText(url);
  if (!html) return null;
  const $ = cheerio.load(html);
  return { title: parseTitle($) };
}

// Slug-aware variant used by the runner. Matches the override map first
// by exact slug, then by slug with version suffix stripped (e.g. an
// `garuda-aiacos-oce` storefront row maps to a `garuda-aiacos` override
// because "OCE" is just a re-release of the same figure).
export async function fetchBySlug(
  productSlug: string,
): Promise<AdapterResult | null> {
  const override = findOverride(productSlug);
  if (!override) return null;

  const url = `https://tamashiiweb.com/item/${override.id}/?wovn=en`;
  const html = await fetchText(url);
  if (!html) return null;
  const $ = cheerio.load(html);

  const specRows = parseSpecRows($);
  const releaseYear = parseReleaseYear(specRows);
  const description = buildSpecDescription(specRows);
  const title = parseTitle($);
  const gallery = extractGallery(html);

  // No gallery + no metadata = useless result.
  if (gallery.length === 0 && releaseYear == null && !description) return null;

  return {
    source: "tamashii",
    sourceUrl: url,
    fields: {
      ...(description ? { description } : {}),
      ...(releaseYear ? { release_year: releaseYear } : {}),
    },
    images: gallery.map((u, i) => ({
      url: u,
      alt: title ? `${title} ${String(i + 1).padStart(2, "0")}` : undefined,
    })),
    confidence: 95, // first-party data, manual mapping
  };
}

export const tamashiiAdapter: SourceAdapter & {
  fetchBySlug: typeof fetchBySlug;
} = {
  name: "tamashii",
  enabled: () => Object.keys(loadOverrides()).length > 0,
  fetch: fetchAdapter,
  fetchBySlug,
};
