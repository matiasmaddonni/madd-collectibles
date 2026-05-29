import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchTamashiiSummary } from "./tamashii";
import type { AdapterResult, CandidateImage, SourceAdapter } from "./types";

// Bundle products are a storefront row that represents a batch of
// figures sold together (e.g. the twelve Soul of Gold gold saints).
// The runner creates a single draft product with figure_count=N and
// pulls the constituent figures' names + release years + hero photos
// directly from Tamashii Web — no eBay / Fandom enrichment, because
// the bundle is priced as a set by hand and the admin uploads the
// "group photo" separately in /admin/products/<id>.
//
// Override file: scripts/crawl/cache/bundle-overrides.json
// Shape:
//   "<bundle-slug>": {
//     "line":   "saint-cloth-myth-ex",  // existing product_lines slug
//     "name":   "...",                  // human title
//     "series": "Saint Seiya",          // find-or-create series
//     "items":  ["13606", "13607", ...] // Tamashii item IDs
//   }
//
// Currently only Tamashii items are supported. To mix in goodsmile /
// megahouse later, swap `items: string[]` for `items: { source, id }[]`
// and dispatch in fetchBundleBySlug.

export type BundleOverride = {
  line: string;
  name?: string;
  series?: string;
  items: string[];
};

const OVERRIDES_PATH = join(
  process.cwd(),
  "scripts",
  "crawl",
  "cache",
  "bundle-overrides.json",
);

type RawOverrideFile = {
  overrides?: Record<string, BundleOverride>;
};

let overridesCache: Record<string, BundleOverride> | null = null;

export function loadBundleOverrides(): Record<string, BundleOverride> {
  if (overridesCache) return overridesCache;
  const out: Record<string, BundleOverride> = {};
  if (existsSync(OVERRIDES_PATH)) {
    try {
      const parsed = JSON.parse(
        readFileSync(OVERRIDES_PATH, "utf8"),
      ) as RawOverrideFile;
      for (const [slug, v] of Object.entries(parsed.overrides ?? {})) {
        if (slug.startsWith("_")) continue;
        if (!v?.line) continue;
        if (!Array.isArray(v.items) || v.items.length === 0) continue;
        const items = v.items.map((s) => String(s).trim()).filter(Boolean);
        if (items.length === 0) continue;
        out[slug] = {
          line: v.line,
          name: v.name,
          series: v.series,
          items,
        };
      }
    } catch {
      // fall through to empty cache
    }
  }
  overridesCache = out;
  return overridesCache;
}

export function bundleSeriesForOverride(slug: string): string | null {
  return loadBundleOverrides()[slug]?.series ?? null;
}

export function isBundleSlug(slug: string): boolean {
  return Boolean(loadBundleOverrides()[slug]);
}

// Aggregate per-item Tamashii fetches into a single AdapterResult that
// the runner can hand to the proposal pipeline. The description is
// intentionally free-form so the admin can rewrite it before publish;
// images are one hero per figure, in the order the items array lists.
export async function fetchBundleBySlug(
  slug: string,
): Promise<AdapterResult | null> {
  const override = loadBundleOverrides()[slug];
  if (!override) return null;

  // First N gallery shots per figure — gives the admin alternatives
  // to "Set primary" from. Tamashii pages typically expose 8-15 photos
  // ordered hero → poses → accessories; 5 per figure covers the hero
  // + main poses without grabbing the prop close-ups.
  const PHOTOS_PER_FIGURE = 5;

  type Part = {
    id: string;
    name: string;
    year: number | null;
    images: string[];
  };
  const parts: Part[] = [];
  for (const id of override.items) {
    const s = await fetchTamashiiSummary(id);
    if (!s) {
      console.warn(`  bundle ${slug}: Tamashii item ${id} unreachable, skipped.`);
      continue;
    }
    parts.push({
      id,
      name: s.title?.trim() || `Tamashii #${id}`,
      year: s.releaseYear,
      images: s.images.slice(0, PHOTOS_PER_FIGURE),
    });
  }
  if (parts.length === 0) return null;

  // Free-text aggregation. Comma-separated "Name (Year)" — admin can
  // edit to anything via the proposal review UI.
  const description =
    "Set incluye " +
    parts
      .map((p) => (p.year ? `${p.name} (${p.year})` : p.name))
      .join(", ") +
    ".";

  // earliest release year for the bundle's release_year field.
  const years = parts.map((p) => p.year).filter((y): y is number => y != null);
  const releaseYear = years.length > 0 ? Math.min(...years) : null;

  const images: CandidateImage[] = [];
  for (const p of parts) {
    p.images.forEach((url, i) => {
      images.push({
        url,
        // Alt is what shows in the admin grid label; "Name #02" makes
        // sister-shot comparisons quick when picking the primary.
        alt: `${p.name} #${String(i + 1).padStart(2, "0")}`,
      });
    });
  }

  return {
    source: "bundle",
    sourceUrl: `bundle:${slug}`,
    fields: {
      description,
      ...(releaseYear ? { release_year: releaseYear } : {}),
    },
    images,
    // High because it's first-party aggregation, but a hair below the
    // single-figure tamashii score so an admin's manual description is
    // not overwritten on re-runs.
    confidence: 90,
  };
}

export const bundleAdapter: SourceAdapter & {
  fetchBySlug: typeof fetchBundleBySlug;
} = {
  name: "bundle",
  enabled: () => Object.keys(loadBundleOverrides()).length > 0,
  // The runner dispatches slug-keyed adapters via fetchBySlug; generic
  // name-search fetch is not meaningful for a bundle.
  fetch: async () => null,
  fetchBySlug: fetchBundleBySlug,
};
