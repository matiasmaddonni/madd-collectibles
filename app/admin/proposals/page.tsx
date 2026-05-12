import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProposalRow = {
  product_id: string;
  field: string;
  source: string;
  confidence: number;
  fetched_at: string;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Group = {
  product: ProductRow;
  fieldsCount: number;
  imagesCount: number;
  sources: Set<string>;
  oldest: string;
};

export default async function ProposalsListPage() {
  const admin = createAdminClient();

  const [proposalsRes, imagesRes] = await Promise.all([
    admin
      .from("crawl_proposals")
      .select("product_id, field, source, confidence, fetched_at")
      .eq("status", "pending")
      .order("fetched_at", { ascending: true }),
    admin
      .from("product_images")
      .select("product_id, proposed_by_source")
      .not("proposed_by_source", "is", null),
  ]);

  const proposals = (proposalsRes.data ?? []) as ProposalRow[];
  const images = (imagesRes.data ?? []) as Array<{
    product_id: string;
    proposed_by_source: string;
  }>;

  // Unique product IDs across both buckets so a product with only image
  // candidates also surfaces here.
  const productIds = new Set<string>();
  for (const p of proposals) productIds.add(p.product_id);
  for (const i of images) productIds.add(i.product_id);

  let products: ProductRow[] = [];
  if (productIds.size > 0) {
    const { data } = await admin
      .from("products")
      .select("id, name, slug, status")
      .in("id", [...productIds]);
    products = (data ?? []) as ProductRow[];
  }
  const productById = new Map(products.map((p) => [p.id, p]));

  const groups = new Map<string, Group>();
  for (const p of proposals) {
    const product = productById.get(p.product_id);
    if (!product) continue;
    let group = groups.get(p.product_id);
    if (!group) {
      group = {
        product,
        fieldsCount: 0,
        imagesCount: 0,
        sources: new Set(),
        oldest: p.fetched_at,
      };
      groups.set(p.product_id, group);
    }
    group.fieldsCount++;
    group.sources.add(p.source);
    if (p.fetched_at < group.oldest) group.oldest = p.fetched_at;
  }
  for (const i of images) {
    const product = productById.get(i.product_id);
    if (!product) continue;
    let group = groups.get(i.product_id);
    if (!group) {
      group = {
        product,
        fieldsCount: 0,
        imagesCount: 0,
        sources: new Set(),
        oldest: new Date().toISOString(),
      };
      groups.set(i.product_id, group);
    }
    group.imagesCount++;
    group.sources.add(i.proposed_by_source);
  }

  const rows = [...groups.values()].sort((a, b) =>
    a.oldest.localeCompare(b.oldest),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Proposals</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No pending proposals. Run <code>npm run crawl:apply -- --slug=…</code>{" "}
          to populate.
        </p>
      ) : (
        <ul className="border border-zinc-300 divide-y divide-zinc-200">
          {rows.map((g) => (
            <li key={g.product.id} className="px-3 py-3 text-sm">
              <Link
                href={`/admin/proposals/${g.product.id}`}
                className="flex flex-wrap items-center justify-between gap-3 hover:underline"
              >
                <span className="font-semibold flex items-center gap-2">
                  {g.product.status === "draft" && (
                    <span className="text-[10px] uppercase tracking-wide bg-amber-200 text-amber-900 px-1.5 py-0.5">
                      New draft
                    </span>
                  )}
                  {g.product.name}
                </span>
                <span className="text-zinc-600 text-xs flex gap-3">
                  <span>{g.fieldsCount} field(s)</span>
                  <span>{g.imagesCount} image(s)</span>
                  <span>{[...g.sources].join(", ")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
