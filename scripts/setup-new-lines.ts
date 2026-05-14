import { loadEnv } from "./crawl/env";
import { createClient } from "@supabase/supabase-js";

// One-shot: apply migration 011 via service role.
//   - Insert proplica + imagination-works rows in product_lines
//     (brand=Tamashii Nations).
//   - Reassign existing PROPLICA Nichirin swords + Imagination Works
//     statues from 'otros' line to their new lines.
//
// Safe to re-run: line inserts use on-conflict-no-op, product updates
// are idempotent by slug.

type Line = { slug: string; name: string; sort_order: number };

const NEW_LINES: Line[] = [
  { slug: "proplica", name: "PROPLICA", sort_order: 50 },
  { slug: "imagination-works", name: "Imagination Works", sort_order: 60 },
];

const PROPLICA_SLUGS = [
  "nichirin-broken-rengoku",
  "nichirin-tengen",
  "nichirin-muichiro",
];

const IMAGINATION_WORKS_SLUGS = ["iw-luffy", "iw-vegeta", "iw-son-goku"];

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: brand, error: brandErr } = await sb
    .from("brands")
    .select("id")
    .eq("slug", "tamashii-nations")
    .single();
  if (brandErr || !brand) throw new Error("Tamashii Nations brand missing");

  for (const line of NEW_LINES) {
    const { data: existing } = await sb
      .from("product_lines")
      .select("id")
      .eq("slug", line.slug)
      .maybeSingle();
    if (existing) {
      console.log(`line ${line.slug}: exists (id=${existing.id})`);
      continue;
    }
    const { data: inserted, error } = await sb
      .from("product_lines")
      .insert({
        brand_id: brand.id,
        slug: line.slug,
        name: line.name,
        sort_order: line.sort_order,
      })
      .select("id")
      .single();
    if (error) throw error;
    console.log(`line ${line.slug}: created (id=${inserted.id})`);
  }

  const { data: lines } = await sb
    .from("product_lines")
    .select("id, slug")
    .in("slug", ["proplica", "imagination-works"]);
  const lineIdBySlug = new Map(
    (lines ?? []).map((l) => [l.slug, l.id as string]),
  );

  async function reassign(slugs: string[], lineSlug: string) {
    const lineId = lineIdBySlug.get(lineSlug);
    if (!lineId) throw new Error(`line ${lineSlug} not found`);
    const { data: updated, error } = await sb
      .from("products")
      .update({ product_line_id: lineId })
      .in("slug", slugs)
      .select("slug");
    if (error) throw error;
    console.log(
      `reassigned to ${lineSlug}: ${(updated ?? []).map((r) => r.slug).join(", ") || "(none)"}`,
    );
  }

  await reassign(PROPLICA_SLUGS, "proplica");
  await reassign(IMAGINATION_WORKS_SLUGS, "imagination-works");

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
