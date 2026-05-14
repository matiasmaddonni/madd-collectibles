import { loadEnv } from "./crawl/env";
import { createClient } from "@supabase/supabase-js";

// Full catalogue gap report. Every product that is missing at least one
// of: primary image / any image / description / price. Grouped so we
// can build a curation plan. Complete products are only counted.

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  type ProductRow = {
    id: string;
    slug: string;
    name: string;
    status: string;
    price: number | string | null;
    description: string | null;
    product_line: { slug?: string } | { slug?: string }[] | null;
  };
  const { data: rawProducts } = await sb
    .from("products")
    .select(
      "id, slug, name, status, price, description, " +
        "product_line:product_lines(slug)",
    );
  const products = (rawProducts ?? []) as unknown as ProductRow[];
  const { data: imgs } = await sb
    .from("product_images")
    .select("product_id, is_primary");

  const imgCount = new Map<string, number>();
  const hasPrimary = new Set<string>();
  for (const r of imgs ?? []) {
    const id = (r as { product_id: string }).product_id;
    imgCount.set(id, (imgCount.get(id) ?? 0) + 1);
    if ((r as { is_primary: boolean }).is_primary) hasPrimary.add(id);
  }

  type Row = {
    slug: string;
    line: string;
    status: string;
    gaps: string[];
  };
  const incomplete: Row[] = [];
  let complete = 0;

  for (const p of products) {
    const id = p.id;
    const pl = Array.isArray(p.product_line)
      ? p.product_line[0]
      : p.product_line;
    const line = pl?.slug ?? "—";
    const imgs = imgCount.get(id) ?? 0;
    const prim = hasPrimary.has(id);
    const hasPrice = Number(p.price) > 0;
    const hasDesc =
      typeof p.description === "string" && p.description.trim().length > 0;

    const gaps: string[] = [];
    if (imgs === 0) gaps.push("NO IMAGES");
    else if (!prim) gaps.push("no primary img");
    if (!hasDesc) gaps.push("no description");
    if (!hasPrice) gaps.push("no price");

    if (gaps.length === 0) {
      complete += 1;
      continue;
    }
    incomplete.push({ slug: p.slug, line, status: p.status, gaps });
  }

  // Group by line.
  const byLine = new Map<string, Row[]>();
  for (const r of incomplete) {
    if (!byLine.has(r.line)) byLine.set(r.line, []);
    byLine.get(r.line)!.push(r);
  }

  const total = (products ?? []).length;
  console.log("=".repeat(72));
  console.log(
    `CATALOGUE: ${total} products · ${complete} complete · ${incomplete.length} need work`,
  );
  console.log("=".repeat(72));

  for (const [line, rows] of [...byLine.entries()].sort()) {
    console.log(`\n■ ${line}  (${rows.length})`);
    for (const r of rows.sort((a, b) => a.slug.localeCompare(b.slug))) {
      console.log(
        `   ${r.slug.padEnd(44)} ${r.status.padEnd(10)} ${r.gaps.join(" · ")}`,
      );
    }
  }

  // Summary by gap type.
  const tally = { noImages: 0, noPrimary: 0, noDesc: 0, noPrice: 0 };
  for (const r of incomplete) {
    if (r.gaps.includes("NO IMAGES")) tally.noImages += 1;
    if (r.gaps.includes("no primary img")) tally.noPrimary += 1;
    if (r.gaps.includes("no description")) tally.noDesc += 1;
    if (r.gaps.includes("no price")) tally.noPrice += 1;
  }
  console.log("\n" + "=".repeat(72));
  console.log("GAP TALLY");
  console.log("=".repeat(72));
  console.log(`   no images:       ${tally.noImages}`);
  console.log(`   no primary img:  ${tally.noPrimary}`);
  console.log(`   no description:  ${tally.noDesc}`);
  console.log(`   no price:        ${tally.noPrice}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
