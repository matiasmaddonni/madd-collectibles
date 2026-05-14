#!/usr/bin/env tsx
// Merge duplicate series rows by name. After migration 010 the
// product_line_id column is nullable, so the same franchise can live
// as one global row. This script finds duplicates by `name`, keeps the
// oldest row as canonical, repoints products.series_id to the canonical
// row, then deletes the others.
//
// Usage:
//   npx tsx scripts/merge-series.ts          # dry-run
//   npx tsx scripts/merge-series.ts --apply  # commit

import { loadEnv } from "./crawl/env";
import { adminClient } from "./crawl/persist";

loadEnv();
const APPLY = process.argv.includes("--apply");

type SeriesRow = {
  id: string;
  slug: string;
  name: string;
  product_line_id: string | null;
};

async function main(): Promise<void> {
  const admin = adminClient();
  const { data: all } = await admin
    .from("series")
    .select("id, slug, name, product_line_id")
    .order("slug", { ascending: true });
  const rows = (all ?? []) as SeriesRow[];

  // Group by name (case-insensitive, trimmed).
  const groups = new Map<string, SeriesRow[]>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const dupes = [...groups.values()].filter((g) => g.length > 1);
  console.log(`series rows: ${rows.length} · duplicate names: ${dupes.length}`);

  let merged = 0;
  let deletedRows = 0;
  let repointed = 0;

  for (const group of dupes) {
    // Canonical = first by slug. Same name, different rows, deterministic.
    const sorted = [...group].sort((a, b) => a.slug.localeCompare(b.slug));
    const canonical = sorted[0]!;
    const others = sorted.slice(1);
    console.log(`\n• ${canonical.name}`);
    console.log(`  keep   : ${canonical.slug} (${canonical.id})`);
    for (const o of others) console.log(`  delete : ${o.slug} (${o.id})`);

    // Repoint products from `others` to `canonical`.
    const otherIds = others.map((o) => o.id);
    const { data: productsHit, count } = await admin
      .from("products")
      .select("id", { count: "exact" })
      .in("series_id", otherIds);
    console.log(`  products to repoint: ${count ?? productsHit?.length ?? 0}`);

    if (APPLY && otherIds.length > 0) {
      const { error: upErr } = await admin
        .from("products")
        .update({ series_id: canonical.id })
        .in("series_id", otherIds);
      if (upErr) {
        console.warn(`  repoint failed: ${upErr.message}`);
        continue;
      }
      repointed += count ?? 0;

      const { error: delErr } = await admin
        .from("series")
        .delete()
        .in("id", otherIds);
      if (delErr) {
        console.warn(`  delete failed: ${delErr.message}`);
        continue;
      }
      deletedRows += others.length;
      merged++;
    } else if (!APPLY) {
      console.log(`  (dry-run) would repoint + delete`);
    }
  }

  console.log(
    `\n${APPLY ? "Merged" : "Would merge"} ${
      APPLY ? merged : dupes.length
    } name(s) · ${APPLY ? "repointed" : "would repoint"} ${
      APPLY ? repointed : "?"
    } product(s) · ${APPLY ? "deleted" : "would delete"} ${
      APPLY ? deletedRows : "?"
    } series row(s). ${APPLY ? "" : "Re-run with --apply to commit."}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
