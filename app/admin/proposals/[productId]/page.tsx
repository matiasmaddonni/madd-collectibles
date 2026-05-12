import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveAllForProduct,
  approveFieldProposal,
  approveImageProposal,
  discardEverythingForProduct,
  getPublishReadiness,
  rejectAllForProduct,
  rejectFieldProposal,
  rejectImageProposal,
} from "../actions";
import { EditableProposed } from "../EditableProposed";
import { PublishPanel } from "../PublishPanel";

const TEXT_EDITABLE_FIELDS = new Set(["description", "sku"]);

export const dynamic = "force-dynamic";

type Proposal = {
  id: string;
  field: string;
  current_value: unknown;
  proposed_value: unknown;
  source: string;
  source_url: string | null;
  confidence: number;
  notes: string | null;
  fetched_at: string;
};

type ProposedImage = {
  id: string;
  url: string;
  proposed_by_source: string;
  alt: string | null;
};

function fmt(v: unknown): string {
  if (v == null) return "(empty)";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

type PageProps = { params: Promise<{ productId: string }> };

export default async function ProposalDetail({ params }: PageProps) {
  const { productId } = await params;
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("id, name, slug, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();
  const p = product as {
    id: string;
    name: string;
    slug: string;
    status: string;
  };

  const [propsRes, imgsRes] = await Promise.all([
    admin
      .from("crawl_proposals")
      .select(
        "id, field, current_value, proposed_value, source, source_url, confidence, notes, fetched_at",
      )
      .eq("product_id", productId)
      .eq("status", "pending")
      .order("field", { ascending: true })
      .order("confidence", { ascending: false }),
    admin
      .from("product_images")
      .select("id, url, proposed_by_source, alt")
      .eq("product_id", productId)
      .not("proposed_by_source", "is", null)
      .order("sort_order", { ascending: true }),
  ]);

  const proposals = (propsRes.data ?? []) as Proposal[];
  const proposedImages = (imgsRes.data ?? []) as ProposedImage[];
  // Draft products get a Publish panel at the top — readiness is computed
  // server-side so the checklist is always fresh on each load.
  const publishReadiness =
    p.status === "draft" ? await getPublishReadiness(p.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          {p.status === "draft" && (
            <span className="text-xs uppercase tracking-wide bg-amber-200 text-amber-900 px-2 py-0.5">
              New draft
            </span>
          )}
          {p.name}
        </h1>
        <div className="flex gap-2 text-xs">
          <Link
            href="/admin/proposals"
            className="px-3 py-1 border border-zinc-400 hover:bg-zinc-100"
          >
            ← Back
          </Link>
          <Link
            href={`/admin/products/${p.id}`}
            className="px-3 py-1 border border-zinc-400 hover:bg-zinc-100"
          >
            Edit product
          </Link>
          {p.status !== "draft" && (
            <Link
              href={`/products/${p.slug}`}
              target="_blank"
              className="px-3 py-1 border border-zinc-400 hover:bg-zinc-100"
            >
              View storefront ↗
            </Link>
          )}
        </div>
      </div>

      {p.status === "draft" && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2">
          This product was created from a crawler override. It&apos;s hidden
          from the storefront until you review proposals + set price/condition
          in <Link href={`/admin/products/${p.id}`} className="underline">Edit product</Link>,
          then click Publish below.
        </div>
      )}

      {publishReadiness && (
        <PublishPanel
          productId={p.id}
          initialReadiness={publishReadiness}
        />
      )}

      {proposals.length === 0 && proposedImages.length === 0 ? (
        <p className="text-sm text-zinc-600">No pending proposals.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={approveAllForProduct.bind(null, p.id)}>
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-green-700 text-white hover:bg-green-800"
            >
              Approve all fields
            </button>
          </form>
          <form action={rejectAllForProduct.bind(null, p.id)}>
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
            >
              Discard all fields
            </button>
          </form>
          <form action={discardEverythingForProduct.bind(null, p.id)}>
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-red-700 text-white hover:bg-red-800 ml-auto"
            >
              Discard everything (fields + images)
            </button>
          </form>
        </div>
      )}

      {proposals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Field proposals</h2>
          <ul className="border border-zinc-300 divide-y divide-zinc-200">
            {proposals.map((prop) => (
              <li
                key={prop.id}
                className="px-3 py-3 text-sm flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono uppercase tracking-wide px-2 py-0.5 bg-zinc-200 text-zinc-800">
                    {prop.field}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700">
                    {prop.source}
                  </span>
                  <span className="text-zinc-600">
                    confidence {prop.confidence}
                  </span>
                  {prop.source_url && (
                    <a
                      href={prop.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline truncate max-w-[40ch]"
                    >
                      source ↗
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-500 mb-1">
                      Current
                    </div>
                    <pre className="whitespace-pre-wrap break-words bg-zinc-50 border border-zinc-200 p-2 text-xs">
                      {fmt(prop.current_value)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-zinc-500 mb-1">
                      Proposed
                    </div>
                    {TEXT_EDITABLE_FIELDS.has(prop.field) &&
                    typeof prop.proposed_value === "string" ? (
                      <EditableProposed
                        proposalId={prop.id}
                        initialValue={prop.proposed_value}
                        editable
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap break-words bg-green-50 border border-green-200 p-2 text-xs">
                        {fmt(prop.proposed_value)}
                      </pre>
                    )}
                  </div>
                </div>
                {prop.notes && (
                  <div className="text-[11px] text-zinc-700 bg-amber-50 border border-amber-200 px-2 py-1">
                    {prop.notes}
                  </div>
                )}
                <div className="flex gap-2">
                  <form action={approveFieldProposal.bind(null, prop.id)}>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs bg-green-700 text-white hover:bg-green-800"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectFieldProposal.bind(null, prop.id)}>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
                    >
                      Discard
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {proposedImages.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Image candidates</h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {proposedImages.map((img) => (
              <li
                key={img.id}
                className="border border-zinc-300 flex flex-col gap-2 p-2"
              >
                <div className="relative aspect-square bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-[10px] uppercase text-zinc-500">
                  {img.proposed_by_source}
                </div>
                <div className="flex flex-wrap gap-1">
                  <form
                    action={approveImageProposal.bind(null, img.id, "primary")}
                  >
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs bg-green-700 text-white hover:bg-green-800"
                    >
                      Set primary
                    </button>
                  </form>
                  <form
                    action={approveImageProposal.bind(null, img.id, "gallery")}
                  >
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs bg-blue-700 text-white hover:bg-blue-800"
                    >
                      Keep
                    </button>
                  </form>
                  <form action={rejectImageProposal.bind(null, img.id)}>
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
                    >
                      Discard
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

