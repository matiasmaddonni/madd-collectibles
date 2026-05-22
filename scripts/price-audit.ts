#!/usr/bin/env tsx
// One-shot data-quality scan for product prices. Read-only.
// Usage: npx tsx scripts/price-audit.ts
//
// Flags: zero/null price, negative price, live products (available /
// reserved) without a price, and likely currency mislabels (USD figure
// priced like ARS or vice-versa). Exits 0 always; it only reports.

import { loadEnv } from "./crawl/env";
import { adminClient } from "./crawl/persist";

loadEnv();

// A figure priced above this in USD, or below this in ARS, is almost
// certainly the wrong currency tag. Tune if the catalog range shifts.
const USD_SUSPICIOUS_ABOVE = 2000;
const ARS_SUSPICIOUS_BELOW = 5000;

type Row = {
  id: string;
  name: string;
  slug: string;
  price: number | string | null;
  currency: "USD" | "ARS" | null;
  status: "draft" | "available" | "reserved" | "sold";
  created_at: string;
  updated_at: string;
};

function fmt(r: Row): string {
  const price = r.price == null ? "null" : String(r.price);
  return `  ${r.status.padEnd(9)} ${(r.currency ?? "?").padEnd(3)} ${price.padStart(9)}  ${r.name}  [${r.slug}]`;
}

function section(label: string, list: Row[]): number {
  if (list.length === 0) return 0;
  console.log(`\n## ${label} (${list.length})`);
  for (const r of list.slice(0, 50)) console.log(fmt(r));
  if (list.length > 50) console.log(`  …+${list.length - 50} more`);
  return list.length;
}

async function main() {
  const admin = adminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, name, slug, price, currency, status, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];
  const num = (p: Row["price"]) => Number(p);

  const zeroOrNull = rows.filter((r) => r.price == null || num(r.price) === 0);
  const negative = rows.filter((r) => num(r.price) < 0);
  const liveNoPrice = rows.filter(
    (r) =>
      (r.status === "available" || r.status === "reserved") &&
      (r.price == null || num(r.price) <= 0),
  );
  const usdHigh = rows.filter(
    (r) => r.currency === "USD" && num(r.price) > USD_SUSPICIOUS_ABOVE,
  );
  const arsLow = rows.filter(
    (r) =>
      r.currency === "ARS" &&
      num(r.price) > 0 &&
      num(r.price) < ARS_SUSPICIOUS_BELOW,
  );

  console.log(`Total products: ${rows.length}`);
  let flagged = 0;
  flagged += section("Price 0 / null", zeroOrNull);
  flagged += section("Negative price", negative);
  flagged += section("LIVE (available/reserved) with no price", liveNoPrice);
  flagged += section(
    `USD price > ${USD_SUSPICIOUS_ABOVE} (currency mislabel?)`,
    usdHigh,
  );
  flagged += section(
    `ARS price < ${ARS_SUSPICIOUS_BELOW} (currency mislabel?)`,
    arsLow,
  );

  if (flagged === 0) {
    console.log("\n✓ No price anomalies found.");
  } else {
    console.log(`\n${flagged} row(s) flagged across checks.`);
  }
}

main();
