#!/usr/bin/env tsx
// One-shot lookup: find products by name ILIKE patterns. Read-only.
// Usage: npx tsx scripts/find-product.ts <pattern> [pattern ...]
// Falls back to a built-in list of Goku-evento patterns if no args.

import { loadEnv } from "./crawl/env";
import { adminClient } from "./crawl/persist";

loadEnv();

async function main() {
  const patterns =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : [
          "%goku%god%",
          "%saiyan god%",
          "%saiyajin god%",
          "%goku%evento%",
          "%evento%goku%",
          "%goku%exclusive%",
        ];

  const admin = adminClient();
  const seen = new Set<string>();

  for (const p of patterns) {
    const { data, error } = await admin
      .from("products")
      .select(
        "id, slug, name, status, product_line_id, series_id, price, currency, sku, release_year",
      )
      .ilike("name", p)
      .order("name");

    if (error) {
      console.error(`pattern ${p} -> error`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`pattern ${p} -> no matches`);
      continue;
    }
    console.log(`\npattern ${p} -> ${data.length} match(es):`);
    for (const row of data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      console.log(
        `  - ${row.slug.padEnd(40)}  ${row.name.padEnd(60)}  status=${row.status}  price=${row.price} ${row.currency}  sku=${row.sku ?? "-"}  year=${row.release_year ?? "-"}`,
      );
    }
  }

  if (seen.size === 0) {
    console.log("\nNo products matched. Try broader patterns.");
    return;
  }

  console.log(`\nTotal unique matches: ${seen.size}`);

  for (const id of seen) {
    const { data } = await admin
      .from("product_images")
      .select("url, is_primary, sort_order")
      .eq("product_id", id)
      .order("is_primary", { ascending: false })
      .order("sort_order")
      .limit(1);
    const img = data?.[0]?.url;
    if (img) {
      const { data: prod } = await admin
        .from("products")
        .select("slug")
        .eq("id", id)
        .maybeSingle();
      console.log(`image[${prod?.slug ?? id}] -> ${img}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
