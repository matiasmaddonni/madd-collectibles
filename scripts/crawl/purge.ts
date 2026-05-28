// One-shot cleanup: drop all pending crawl_proposals + all
// crawler-staged product_images (proposed_by_source IS NOT NULL).
// Run: npx tsx scripts/crawl/purge.ts
import { adminClient } from "./persist";

async function main() {
  const admin = adminClient();

  const { data: pendingProps, error: propsCountErr } = await admin
    .from("crawl_proposals")
    .select("id", { count: "exact" })
    .eq("status", "pending");
  if (propsCountErr) throw propsCountErr;

  const { data: stagedImgs, error: imgsCountErr } = await admin
    .from("product_images")
    .select("id, url", { count: "exact" })
    .not("proposed_by_source", "is", null);
  if (imgsCountErr) throw imgsCountErr;

  const { data: drafts, error: draftsErr } = await admin
    .from("products")
    .select("id, slug", { count: "exact" })
    .eq("status", "draft");
  if (draftsErr) throw draftsErr;

  console.log(`Pending proposals: ${pendingProps?.length ?? 0}`);
  console.log(`Crawler-staged images: ${stagedImgs?.length ?? 0}`);
  console.log(`Draft products (status='draft'): ${drafts?.length ?? 0}`);
  if (drafts && drafts.length > 0) {
    for (const d of drafts) console.log(`  - ${d.slug}`);
  }

  if ((pendingProps?.length ?? 0) > 0) {
    const { error } = await admin
      .from("crawl_proposals")
      .delete()
      .eq("status", "pending");
    if (error) throw error;
    console.log(`Deleted ${pendingProps!.length} pending proposals.`);
  }

  if ((stagedImgs?.length ?? 0) > 0) {
    const { error } = await admin
      .from("product_images")
      .delete()
      .not("proposed_by_source", "is", null);
    if (error) throw error;
    console.log(`Deleted ${stagedImgs!.length} crawler-staged images.`);
  }

  // Delete stale drafts: slugs that were created on a prior run but
  // whose override entries have since been removed.
  const staleSlugs = [
    "figuarts-mini-hatsune-miku",
    "metal-robot-12324",
    "metal-robot-14571",
  ];
  const { data: stale } = await admin
    .from("products")
    .select("id, slug")
    .in("slug", staleSlugs)
    .eq("status", "draft");
  if (stale && stale.length > 0) {
    const ids = stale.map((s) => s.id);
    // Drop any remaining FKs first.
    await admin.from("product_images").delete().in("product_id", ids);
    await admin.from("crawl_proposals").delete().in("product_id", ids);
    const { error } = await admin.from("products").delete().in("id", ids);
    if (error) throw error;
    console.log(`Deleted ${stale.length} stale draft(s):`);
    for (const s of stale) console.log(`  - ${s.slug}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
