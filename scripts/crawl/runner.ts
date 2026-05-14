import { adminClient, proposeField, proposeImage } from "./persist";
import { isEmpty, stripVersionSuffix } from "./normalise";
import { sleep } from "./http";
import type {
  AdapterResult,
  ProposalFields,
  SourceAdapter,
} from "./sources/types";
import {
  fetchTamashiiBasics,
  loadOverrides,
  seriesForOverride,
  slugsForBatch,
  tamashiiAdapter,
} from "./sources/tamashii";
import { fandomAdapter } from "./sources/fandom";
import { ebayAdapter } from "./sources/ebay";
import { goodsmileAdapter } from "./sources/goodsmile";
import { megahouseAdapter } from "./sources/megahouse";

const ALL_ADAPTERS: SourceAdapter[] = [
  tamashiiAdapter,
  goodsmileAdapter,
  megahouseAdapter,
  fandomAdapter,
  ebayAdapter,
];

// Per-run upload cap. Detail pages on Tamashii return 8-12 photos; we
// don't want to flood storage with every variant. The user can promote
// or reject in the review UI.
const MAX_IMAGES_PER_PRODUCT = 4;

export type RunnerOptions = {
  slug?: string;
  line?: string;
  missing?: string;
  source?: string;
  limit?: number;
  apply: boolean;
  // Crawl only slugs in the named `_batches` group from
  // tamashii-overrides.json. Lets the admin add a new line to the
  // override file and run just that batch without touching everything.
  batch?: string;
  // When false (default), skip hitting an adapter if there's already a
  // pending proposal OR a candidate image from that source for the
  // product. Avoids re-crawling overrides that are already queued up.
  // Pass --force to re-fetch anyway (useful when the source page got
  // updated and you want fresh data).
  force?: boolean;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  release_year: number | null;
  tags: string[] | null;
  price: number | string | null;
  currency: "ARS" | "USD" | null;
  sku: string | null;
  product_line: { slug: string; name: string } | { slug: string; name: string }[] | null;
  series: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

function takeOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Returns the list of override slugs that don't yet exist in the
// `products` table AND specify a `line` (i.e. opt-in to draft
// creation). Filtered by --slug / --line CLI flags so a targeted run
// doesn't touch unrelated overrides.
async function findMissingOverrideSlugs(
  opts: RunnerOptions,
): Promise<Array<{ slug: string; line: string; name?: string; id: string }>> {
  const overrides = loadOverrides();
  const batchSlugs = opts.batch ? new Set(slugsForBatch(opts.batch)) : null;
  const candidates = Object.entries(overrides)
    .filter(([, v]) => Boolean(v.line))
    .map(([slug, v]) => ({
      slug,
      line: v.line!,
      name: v.name,
      id: v.id,
    }));
  const filtered = candidates.filter((c) => {
    if (opts.slug && c.slug !== opts.slug) return false;
    if (opts.line && c.line !== opts.line) return false;
    if (batchSlugs && !batchSlugs.has(c.slug)) return false;
    return true;
  });
  if (filtered.length === 0) return [];

  const admin = adminClient();
  const { data } = await admin
    .from("products")
    .select("slug")
    .in(
      "slug",
      filtered.map((c) => c.slug),
    );
  const existing = new Set(
    ((data ?? []) as Array<{ slug: string }>).map((r) => r.slug),
  );
  return filtered.filter((c) => !existing.has(c.slug));
}

async function previewDraftsForOverrides(
  opts: RunnerOptions,
): Promise<string[]> {
  const missing = await findMissingOverrideSlugs(opts);
  return missing.map((m) => m.slug);
}

// Find-or-create a series row by NAME (line-agnostic per migration 010).
// `productLineId` is still accepted as a hint for new rows but no longer
// scopes the lookup — a single global row represents the franchise.
async function ensureSeries(
  productLineId: string | null,
  seriesName: string,
): Promise<string | null> {
  const admin = adminClient();
  const trimmed = seriesName.trim();
  if (!trimmed) return null;
  // Case-insensitive name match across the whole table.
  const { data: existing } = await admin
    .from("series")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  // Generate slug; auto-suffix on UNIQUE collision.
  const baseSlug = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let slug = baseSlug;
  let suffix = 0;
  while (true) {
    const { data: clash } = await admin
      .from("series")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
    if (suffix > 50) return null;
  }
  const { data: inserted, error } = await admin
    .from("series")
    .insert({
      product_line_id: productLineId, // hint only; column is nullable
      slug,
      name: trimmed,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (error) {
    console.warn(`ensureSeries failed: ${error.message}`);
    return null;
  }
  return (inserted as { id: string }).id;
}

async function ensureDraftsForOverrides(
  opts: RunnerOptions,
): Promise<number> {
  const missing = await findMissingOverrideSlugs(opts);
  if (missing.length === 0) return 0;
  const admin = adminClient();

  // Resolve product_line slug → id once for the batch.
  const { data: lineRows } = await admin
    .from("product_lines")
    .select("id, slug")
    .in(
      "slug",
      missing.map((m) => m.line),
    );
  const lineIdBySlug: Record<string, string> = {};
  for (const r of (lineRows ?? []) as Array<{ id: string; slug: string }>) {
    lineIdBySlug[r.slug] = r.id;
  }

  let created = 0;
  for (const m of missing) {
    const lineId = lineIdBySlug[m.line];
    if (!lineId) {
      console.warn(
        `Skip draft ${m.slug}: product_line "${m.line}" not found in DB.`,
      );
      continue;
    }
    // Seed name from explicit override, falling back to Tamashii's EN
    // title. If Tamashii is unreachable we use the slug as a humanised
    // placeholder so the row passes NOT NULL — admin renames on review.
    let name = m.name ?? null;
    if (!name) {
      const basics = await fetchTamashiiBasics(m.id);
      name = basics?.title ?? slugToTitle(m.slug);
    }
    // Resolve series via per-override field → batch default → null.
    const seriesName = seriesForOverride(m.slug);
    const seriesId = seriesName
      ? await ensureSeries(lineId, seriesName)
      : null;

    const { error } = await admin.from("products").insert({
      slug: m.slug,
      name,
      product_line_id: lineId,
      series_id: seriesId,
      price: 0, // placeholder; admin sets the real price before publish
      currency: "USD",
      condition: "mint_sealed",
      status: "draft",
      stock_qty: 1,
    });
    if (error) {
      console.warn(`Failed to create draft ${m.slug}: ${error.message}`);
      continue;
    }
    const seriesNote = seriesName ? ` · series=${seriesName}` : "";
    console.log(`✓ Created draft product: ${m.slug} (${name})${seriesNote}`);
    created++;
  }
  return created;
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// Returns a Set of "<productId>|<source>" keys that already have either
// a pending field proposal OR a candidate image. The runner uses this
// to skip adapters that have already queued up data for a product, so
// re-runs don't hammer the source sites or churn proposal rows.
async function loadExistingProposalKeys(
  productIds: string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const admin = adminClient();
  const [propsRes, imgsRes] = await Promise.all([
    admin
      .from("crawl_proposals")
      .select("product_id, source")
      .in("product_id", productIds)
      .eq("status", "pending"),
    admin
      .from("product_images")
      .select("product_id, proposed_by_source")
      .in("product_id", productIds)
      .not("proposed_by_source", "is", null),
  ]);
  const keys = new Set<string>();
  for (const r of (propsRes.data ?? []) as Array<{
    product_id: string;
    source: string;
  }>) {
    keys.add(`${r.product_id}|${r.source}`);
  }
  for (const r of (imgsRes.data ?? []) as Array<{
    product_id: string;
    proposed_by_source: string;
  }>) {
    keys.add(`${r.product_id}|${r.proposed_by_source}`);
  }
  return keys;
}

async function loadProducts(opts: RunnerOptions): Promise<ProductRow[]> {
  const admin = adminClient();
  let q = admin
    .from("products")
    .select(
      `id, slug, name, description, release_year, tags, price, currency, sku,
       product_line:product_lines!inner ( slug, name ),
       series:series ( slug, name )`,
    );
  if (opts.slug) q = q.eq("slug", opts.slug);
  if (opts.line) q = q.eq("product_lines.slug", opts.line);
  // Batch filter is applied post-fetch so version-suffixed slugs in the
  // products table (e.g. `garuda-aiacos-oce`) still match a stripped
  // override key like `garuda-aiacos` from the _batches list.
  const batchSlugSet = opts.batch
    ? new Set(slugsForBatch(opts.batch))
    : null;
  if (batchSlugSet && batchSlugSet.size === 0) return [];
  if (opts.missing) {
    // For text/array columns, "is.null" or empty filter; for numeric (price),
    // also accept 0.
    if (opts.missing === "price") {
      q = q.or("price.is.null,price.eq.0");
    } else {
      q = q.is(opts.missing, null);
    }
  }
  q = q.order("created_at", { ascending: true });
  // Don't apply DB-level limit when batch filtering — we need the full
  // set to filter post-fetch. Apply limit at the very end instead.
  if (opts.limit && !batchSlugSet) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as unknown as ProductRow[];
  if (batchSlugSet) {
    rows = rows.filter(
      (r) =>
        batchSlugSet.has(r.slug) ||
        batchSlugSet.has(stripVersionSuffix(r.slug)),
    );
    if (opts.limit) rows = rows.slice(0, opts.limit);
  }
  return rows;
}

function shouldPropose(currentValue: unknown, proposed: unknown): boolean {
  if (proposed == null) return false;
  if (Array.isArray(proposed) && proposed.length === 0) return false;
  if (typeof proposed === "string" && proposed.trim().length === 0) return false;
  // Fill-only-empty rule: never overwrite manual edits.
  if (!isEmpty(currentValue)) return false;
  return true;
}

function getCurrentValue(row: ProductRow, field: string): unknown {
  switch (field) {
    case "description":
      return row.description;
    case "release_year":
      return row.release_year;
    case "tags":
      return row.tags;
    case "price":
      return row.price == null ? null : Number(row.price);
    case "currency":
      return row.currency;
    case "sku":
      return row.sku;
    default:
      return undefined;
  }
}

function logProposalDry(
  product: ProductRow,
  result: AdapterResult,
  newFields: Array<[keyof ProposalFields, unknown]>,
): void {
  console.log(
    `  ↳ ${result.source} (confidence ${result.confidence}) — ${result.sourceUrl}`,
  );
  if (newFields.length === 0 && result.images.length === 0) {
    console.log("    no fields to propose, no images");
    return;
  }
  for (const [field, proposed] of newFields) {
    const current = getCurrentValue(product, field);
    console.log(`    ${field}:`);
    console.log(`      current : ${JSON.stringify(current)}`);
    console.log(`      proposed: ${JSON.stringify(proposed)}`);
  }
  for (const img of result.images) {
    console.log(`    image    : ${img.url}`);
  }
}

export async function run(opts: RunnerOptions): Promise<{
  productsScanned: number;
  fieldsProposed: number;
  imagesProposed: number;
}> {
  const enabled = ALL_ADAPTERS.filter((a) => {
    if (!a.enabled()) return false;
    if (opts.source) {
      const allow = new Set(opts.source.split(",").map((s) => s.trim()));
      return allow.has(a.name);
    }
    return true;
  });
  if (enabled.length === 0) {
    console.warn("No enabled adapters. Check --source flag + env vars.");
    return { productsScanned: 0, fieldsProposed: 0, imagesProposed: 0 };
  }

  // Detect Tamashii overrides for slugs that don't yet exist in the
  // `products` table. Each such slug becomes a new `status='draft'`
  // product row (hidden from the storefront via RLS) before the normal
  // proposal loop runs. This is how new items enter the catalog via
  // the crawler.
  let createdDrafts = 0;
  if (opts.apply) {
    createdDrafts = await ensureDraftsForOverrides(opts);
    if (createdDrafts > 0) {
      console.log(`Created ${createdDrafts} draft product(s) from overrides.`);
    }
  } else {
    const wouldCreate = await previewDraftsForOverrides(opts);
    if (wouldCreate.length > 0) {
      console.log(
        `Would create ${wouldCreate.length} draft(s) on --apply: ${wouldCreate.join(", ")}`,
      );
    }
  }

  const products = await loadProducts(opts);
  if (products.length === 0) {
    console.warn("No products matched the given filters.");
    return { productsScanned: 0, fieldsProposed: 0, imagesProposed: 0 };
  }
  // Per-source skip set: ignore adapters that already have queued
  // proposals or images for a product. --force opts out.
  const existingKeys = opts.force
    ? new Set<string>()
    : await loadExistingProposalKeys(products.map((p) => p.id));
  console.log(
    `Adapters: ${enabled.map((a) => a.name).join(", ")} · ` +
      `Products: ${products.length} · ` +
      `Mode: ${opts.apply ? "APPLY" : "dry-run"}${opts.force ? " · FORCE" : ""}`,
  );

  let fieldsProposed = 0;
  let imagesProposed = 0;

  for (const product of products) {
    const line = takeOne(product.product_line);
    if (!line) {
      console.log(`Skip ${product.slug}: no product_line`);
      continue;
    }
    const series = takeOne(product.series);
    console.log(
      `\n• ${product.name} (${product.slug}) · line=${line.slug}`,
    );

    for (const adapter of enabled) {
      if (existingKeys.has(`${product.id}|${adapter.name}`)) {
        console.log(
          `  ↳ ${adapter.name}: skipped (already has pending data — use --force to re-crawl)`,
        );
        continue;
      }
      let result: AdapterResult | null = null;
      try {
        // Override-file adapters (Tamashii, Good Smile, MegaHouse) map
        // storefront slugs → source URLs/IDs and expose `fetchBySlug`.
        // Search-based adapters (Fandom, eBay) use the generic `fetch`.
        const fetched =
          "fetchBySlug" in adapter &&
          typeof (adapter as { fetchBySlug?: unknown }).fetchBySlug === "function"
            ? await (
                adapter as {
                  fetchBySlug: (s: string) => Promise<AdapterResult | null>;
                }
              ).fetchBySlug(product.slug)
            : await adapter.fetch({
                name: product.name,
                lineSlug: line.slug,
                lineName: line.name,
                seriesName: series?.name ?? null,
              });
        result = fetched;
      } catch (err) {
        console.log(`  ↳ ${adapter.name} ERROR: ${(err as Error).message}`);
        continue;
      }
      if (!result) {
        console.log(`  ↳ ${adapter.name}: no match`);
        continue;
      }

      const newFields: Array<[keyof ProposalFields, unknown]> = [];
      for (const [field, proposed] of Object.entries(result.fields) as Array<
        [keyof ProposalFields, unknown]
      >) {
        const current = getCurrentValue(product, field);
        // eBay price is always proposed as reference — the admin compares
        // current to median in the proposal notes and decides whether to
        // bump the storefront price. Other sources/fields stick to the
        // fill-only-empty rule (never overwrite manual edits).
        const isEbayPrice = result.source === "ebay" && field === "price";
        if (!isEbayPrice && !shouldPropose(current, proposed)) continue;
        if (isEbayPrice && proposed == null) continue;
        newFields.push([field, proposed]);
      }

      logProposalDry(product, result, newFields);

      if (opts.apply) {
        for (const [field, proposed] of newFields) {
          await proposeField({
            productId: product.id,
            field,
            currentValue: getCurrentValue(product, field),
            proposedValue: proposed,
            source: result.source,
            sourceUrl: result.sourceUrl,
            confidence: result.confidence,
            notes: result.notes?.[field] ?? null,
          });
          fieldsProposed++;
        }
        const imagesToUpload = result.images.slice(0, MAX_IMAGES_PER_PRODUCT);
        for (const img of imagesToUpload) {
          const r = await proposeImage({
            productId: product.id,
            productSlug: product.slug,
            candidate: img,
            source: result.source,
          });
          if (r.uploaded) imagesProposed++;
          else console.log(`    image skipped: ${r.reason}`);
        }
      }

      await sleep(300);
    }
  }

  return {
    productsScanned: products.length,
    fieldsProposed,
    imagesProposed,
  };
}
