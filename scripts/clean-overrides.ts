import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./crawl/env";
import { createClient } from "@supabase/supabase-js";

// Removes "done" override entries (published + price + description +
// >=1 image) from tamashii-overrides.json. Keeps every section:
//   - _doc, _batch_series  (untouched)
//   - _batches.<name>      (keys kept; done slugs pulled from arrays)
//   - overrides._comment_* (divider keys kept)
// Only real slug entries that are fully done get deleted.

type OverrideObj = { id: string; line?: string; series?: string; name?: string };

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

  const json = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as {
    _doc: unknown;
    _batch_series: Record<string, string>;
    _batches: Record<string, string[]>;
    overrides: Record<string, string | OverrideObj>;
  };

  const slugs = Object.keys(json.overrides).filter((k) => !k.startsWith("_"));

  const { data: allProducts } = await sb
    .from("products")
    .select("id, slug, status, price, description");
  const prodBySlug = new Map(
    (allProducts ?? []).map((p) => [p.slug as string, p]),
  );
  const { data: allImgs } = await sb
    .from("product_images")
    .select("product_id");
  const imgCount = new Map<string, number>();
  for (const r of allImgs ?? []) {
    const id = (r as { product_id: string }).product_id;
    imgCount.set(id, (imgCount.get(id) ?? 0) + 1);
  }

  const done = new Set<string>();
  for (const slug of slugs) {
    const p = prodBySlug.get(slug);
    if (!p) continue;
    const imgs = imgCount.get(p.id as string) ?? 0;
    const hasPrice = Number(p.price) > 0;
    const hasDesc =
      typeof p.description === "string" && p.description.trim().length > 0;
    if (p.status === "available" && hasPrice && hasDesc && imgs > 0) {
      done.add(slug);
    }
  }

  // 1. Drop done slugs from overrides (keep _comment_* keys).
  let removedOverrides = 0;
  for (const slug of done) {
    if (slug in json.overrides) {
      delete json.overrides[slug];
      removedOverrides += 1;
    }
  }

  // 2. Pull done slugs out of each _batches array (keep the keys).
  let removedFromBatches = 0;
  for (const [batch, list] of Object.entries(json._batches)) {
    const kept = list.filter((s) => {
      if (done.has(s)) {
        removedFromBatches += 1;
        return false;
      }
      return true;
    });
    json._batches[batch] = kept;
  }

  writeFileSync(OVERRIDES_PATH, JSON.stringify(json, null, 2) + "\n", "utf8");

  console.log(`done entries detected: ${done.size}`);
  console.log(`removed from overrides: ${removedOverrides}`);
  console.log(`removed from _batches arrays: ${removedFromBatches}`);
  console.log(
    `overrides remaining (real slugs): ${
      Object.keys(json.overrides).filter((k) => !k.startsWith("_")).length
    }`,
  );
  const emptyBatches = Object.entries(json._batches)
    .filter(([, v]) => v.length === 0)
    .map(([k]) => k);
  if (emptyBatches.length)
    console.log(`now-empty batch sections: ${emptyBatches.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
