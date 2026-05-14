import { loadEnv } from "./crawl/env";
import { createClient } from "@supabase/supabase-js";

// Find storage objects in the product-images bucket that no
// product_images row references, and delete them. Orphans accumulate
// when a product row is deleted (FK cascade drops the DB rows but not
// the files) or an upload half-fails. Pass --apply to delete.

const BUCKET = "product-images";

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. Every storage object path (recurse one level: <folder>/<file>).
  const objectPaths: string[] = [];
  const { data: top } = await sb.storage.from(BUCKET).list("", { limit: 1000 });
  for (const entry of top ?? []) {
    if (entry.id == null) {
      // folder — list its contents
      const { data: inner } = await sb.storage
        .from(BUCKET)
        .list(entry.name, { limit: 1000 });
      for (const f of inner ?? []) {
        if (f.id != null) objectPaths.push(`${entry.name}/${f.name}`);
      }
    } else {
      objectPaths.push(entry.name);
    }
  }

  // 2. Every path referenced by a product_images row.
  const { data: rows } = await sb.from("product_images").select("url");
  const referenced = new Set<string>();
  const marker = `/object/public/${BUCKET}/`;
  for (const r of rows ?? []) {
    const url = (r as { url: string }).url;
    const i = url.indexOf(marker);
    if (i !== -1) referenced.add(decodeURIComponent(url.slice(i + marker.length)));
  }

  // 3. Orphans = objects with no referencing row.
  const orphans = objectPaths.filter((p) => !referenced.has(p));

  console.log(`storage objects : ${objectPaths.length}`);
  console.log(`referenced rows : ${referenced.size}`);
  console.log(`orphans         : ${orphans.length}`);
  for (const o of orphans) console.log(`  ${o}`);

  if (orphans.length === 0) {
    console.log("\nNo orphans. Bucket clean.");
    return;
  }
  if (!apply) {
    console.log(`\nDRY RUN — re-run with --apply to delete ${orphans.length}.`);
    return;
  }

  const { error } = await sb.storage.from(BUCKET).remove(orphans);
  if (error) throw error;
  console.log(`\nDeleted ${orphans.length} orphan object(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
