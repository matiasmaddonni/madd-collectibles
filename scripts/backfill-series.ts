#!/usr/bin/env tsx
// Backfill products.series_id for rows that are missing one based on
// the batch they belong to in tamashii-overrides.json. Idempotent —
// running it twice is a no-op for already-set rows.
//
// Usage:
//   npx tsx scripts/backfill-series.ts          # dry-run
//   npx tsx scripts/backfill-series.ts --apply  # write

import { loadEnv } from "./crawl/env";
import { adminClient } from "./crawl/persist";
import {
  loadOverrides,
  seriesForOverride,
} from "./crawl/sources/tamashii";

loadEnv();

const APPLY = process.argv.includes("--apply");
// --force overwrites series_id even when one is already set. Use when
// you want the batch-specific series (e.g. "Dragon Ball GT") to replace
// a coarser fallback (e.g. generic "Dragon Ball").
const FORCE = process.argv.includes("--force");

function unique<T>(a: T[]): T[] {
  return [...new Set(a)];
}

async function ensureSeries(
  productLineId: string | null,
  seriesName: string,
): Promise<string | null> {
  const admin = adminClient();
  const trimmed = seriesName.trim();
  if (!trimmed) return null;
  // Line-agnostic name match (post migration 010).
  const { data: existing } = await admin
    .from("series")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

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
  if (!APPLY) {
    console.log(`  (dry-run) would create series '${trimmed}' [line=${productLineId}, slug=${slug}]`);
    return "would-create";
  }
  const { data: inserted, error } = await admin
    .from("series")
    .insert({
      product_line_id: productLineId,
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

async function main(): Promise<void> {
  const overrides = loadOverrides();
  const allSlugs = unique(Object.keys(overrides));
  const admin = adminClient();

  const { data: products } = await admin
    .from("products")
    .select("id, slug, name, series_id, product_line_id")
    .in("slug", allSlugs);
  const rows = (products ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    series_id: string | null;
    product_line_id: string;
  }>;
  console.log(`Inspecting ${rows.length} products matching override slugs.`);

  let touched = 0;
  for (const p of rows) {
    if (p.series_id != null && !FORCE) continue;
    const seriesName = seriesForOverride(p.slug);
    if (!seriesName) continue;
    const seriesId = await ensureSeries(p.product_line_id, seriesName);
    if (!seriesId) {
      console.warn(`Skip ${p.slug}: couldn't ensure series '${seriesName}'`);
      continue;
    }
    if (APPLY && seriesId !== "would-create") {
      const { error } = await admin
        .from("products")
        .update({ series_id: seriesId })
        .eq("id", p.id);
      if (error) {
        console.warn(`Update failed for ${p.slug}: ${error.message}`);
        continue;
      }
    }
    console.log(
      `${APPLY ? "✓" : "·"} ${p.slug} → series='${seriesName}' (${p.name})`,
    );
    touched++;
  }

  console.log(
    `\n${APPLY ? "Updated" : "Would update"} ${touched} product(s). ${
      APPLY ? "" : "Re-run with --apply to commit."
    }`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
