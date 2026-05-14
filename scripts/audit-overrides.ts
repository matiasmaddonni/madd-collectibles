import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./crawl/env";
import { createClient } from "@supabase/supabase-js";

// Two reports:
//  1. Override entries whose product is fully done (published + has
//     price + description + >=1 image) -> safe to drop from the
//     overrides file. Section comments stay.
//  2. Products still untouched (no images AND no description AND no
//     price) -> need a crawl/curation plan.

type OverrideObj = { id: string; line?: string; series?: string; name?: string };
type Overrides = Record<string, string | OverrideObj | string[] | unknown>;

const OVERRIDES_PATH = join(
  process.cwd(),
  "scripts/crawl/cache/tamashii-overrides.json",
);

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const raw = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as {
    overrides: Overrides;
  };
  const overrides = raw.overrides;

  // Real slug entries = keys not starting with "_".
  const slugs = Object.keys(overrides).filter((k) => !k.startsWith("_"));

  // Pull every product once.
  const { data: allProducts } = await sb
    .from("products")
    .select("id, slug, name, status, price, description");
  const prodBySlug = new Map(
    (allProducts ?? []).map((p) => [p.slug as string, p]),
  );

  // Image counts per product.
  const { data: allImgs } = await sb
    .from("product_images")
    .select("product_id");
  const imgCount = new Map<string, number>();
  for (const r of allImgs ?? []) {
    const id = (r as { product_id: string }).product_id;
    imgCount.set(id, (imgCount.get(id) ?? 0) + 1);
  }

  // ---- Report 1: override entries done ----
  const done: string[] = [];
  const pending: { slug: string; reason: string }[] = [];
  const missing: string[] = [];

  for (const slug of slugs) {
    const p = prodBySlug.get(slug);
    if (!p) {
      missing.push(slug);
      continue;
    }
    const imgs = imgCount.get(p.id as string) ?? 0;
    const hasPrice = Number(p.price) > 0;
    const hasDesc =
      typeof p.description === "string" && p.description.trim().length > 0;
    const published = p.status === "available";
    if (published && hasPrice && hasDesc && imgs > 0) {
      done.push(slug);
    } else {
      const gaps: string[] = [];
      if (!published) gaps.push(`status=${p.status}`);
      if (!hasPrice) gaps.push("no price");
      if (!hasDesc) gaps.push("no description");
      if (imgs === 0) gaps.push("no images");
      pending.push({ slug, reason: gaps.join(", ") });
    }
  }

  console.log("=".repeat(70));
  console.log(`OVERRIDE ENTRIES: ${slugs.length} total`);
  console.log("=".repeat(70));
  console.log(`\n✓ DONE — safe to remove from overrides (${done.length}):`);
  for (const s of done) console.log(`    ${s}`);
  console.log(`\n… STILL PENDING — keep in overrides (${pending.length}):`);
  for (const { slug, reason } of pending)
    console.log(`    ${slug.padEnd(42)} ${reason}`);
  if (missing.length) {
    console.log(
      `\n? NO PRODUCT ROW — keep (draft not yet created) (${missing.length}):`,
    );
    for (const s of missing) console.log(`    ${s}`);
  }

  // ---- Report 2: untouched products (whole catalogue) ----
  const untouched: { slug: string; name: string; status: string }[] = [];
  for (const p of allProducts ?? []) {
    const imgs = imgCount.get(p.id as string) ?? 0;
    const hasPrice = Number(p.price) > 0;
    const hasDesc =
      typeof p.description === "string" && p.description.trim().length > 0;
    if (imgs === 0 && !hasDesc && !hasPrice) {
      untouched.push({
        slug: p.slug as string,
        name: p.name as string,
        status: p.status as string,
      });
    }
  }
  console.log("\n" + "=".repeat(70));
  console.log(`UNTOUCHED PRODUCTS — no images, no description, no price (${untouched.length})`);
  console.log("=".repeat(70));
  for (const u of untouched)
    console.log(`    ${u.slug.padEnd(42)} ${u.status.padEnd(11)} ${u.name}`);

  // Machine-readable block for the cleanup step.
  console.log("\n---DONE-SLUGS-JSON---");
  console.log(JSON.stringify(done));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
