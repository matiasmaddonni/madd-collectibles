import Link from "next/link";
import Image from "next/image";
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
} from "./actions";
import { EditableProposed } from "./EditableProposed";
import { PublishPanel } from "./PublishPanel";
import { PropListItem } from "./_components/PropListItem";
import { FilterTabs } from "./_components/FilterTabs";

export const dynamic = "force-dynamic";

const TEXT_EDITABLE = new Set(["description", "sku"]);

type SearchParams = { id?: string; status?: string };

type ProposalRow = {
  id: string;
  product_id: string;
  field: string;
  current_value: unknown;
  proposed_value: unknown;
  source: string;
  source_url: string | null;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  fetched_at: string;
};
type ProposedImageRow = {
  id: string;
  product_id: string;
  url: string;
  proposed_by_source: string;
  alt: string | null;
  is_primary: boolean;
  sort_order: number;
};
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "available" | "reserved" | "sold";
  product_line:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
};

function getOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "(empty)";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

function confTier(c: number): "high" | "med" | "low" {
  if (c >= 90) return "high";
  if (c >= 70) return "med";
  return "low";
}

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filterStatus = (sp.status as "all" | "new" | "in_review") || "new";

  const admin = createAdminClient();

  const [allPropsRes, allImgsRes] = await Promise.all([
    admin
      .from("crawl_proposals")
      .select(
        "id, product_id, field, current_value, proposed_value, source, source_url, confidence, status, notes, fetched_at",
      )
      .order("fetched_at", { ascending: false }),
    admin
      .from("product_images")
      .select(
        "id, product_id, url, proposed_by_source, alt, is_primary, sort_order",
      )
      .not("proposed_by_source", "is", null),
  ]);

  const allProps = (allPropsRes.data ?? []) as ProposalRow[];
  const allImgs = (allImgsRes.data ?? []) as ProposedImageRow[];

  // Group by product. A product is in the queue if it has at least one pending
  // field proposal OR at least one crawler-staged image.
  type Group = {
    productId: string;
    fieldCount: number;
    pendingCount: number;
    decidedCount: number;
    imageCount: number;
    sources: Set<string>;
    avgConfidence: number;
    fetchedAt: string;
  };
  const groups = new Map<string, Group>();
  const ensure = (id: string): Group => {
    let g = groups.get(id);
    if (!g) {
      g = {
        productId: id,
        fieldCount: 0,
        pendingCount: 0,
        decidedCount: 0,
        imageCount: 0,
        sources: new Set(),
        avgConfidence: 0,
        fetchedAt: "1970-01-01T00:00:00Z",
      };
      groups.set(id, g);
    }
    return g;
  };
  const confSums = new Map<string, { sum: number; n: number }>();
  for (const p of allProps) {
    const g = ensure(p.product_id);
    g.fieldCount++;
    if (p.status === "pending") g.pendingCount++;
    else g.decidedCount++;
    g.sources.add(p.source);
    if (p.fetched_at > g.fetchedAt) g.fetchedAt = p.fetched_at;
    if (p.status === "pending") {
      const c = confSums.get(p.product_id) ?? { sum: 0, n: 0 };
      c.sum += p.confidence;
      c.n++;
      confSums.set(p.product_id, c);
    }
  }
  for (const img of allImgs) {
    const g = ensure(img.product_id);
    g.imageCount++;
    g.sources.add(img.proposed_by_source);
  }
  for (const [pid, s] of confSums) {
    const g = groups.get(pid);
    if (g) g.avgConfidence = Math.round(s.sum / s.n);
  }

  const allGroups = Array.from(groups.values()).filter(
    (g) => g.pendingCount > 0 || g.imageCount > 0,
  );

  const withStatus = allGroups.map((g) => ({
    ...g,
    derivedStatus: (g.decidedCount === 0 ? "new" : "in_review") as
      | "new"
      | "in_review",
  }));

  const counts = {
    all: withStatus.length,
    new: withStatus.filter((g) => g.derivedStatus === "new").length,
    in_review: withStatus.filter((g) => g.derivedStatus === "in_review").length,
  };

  let filtered = withStatus;
  if (filterStatus === "new")
    filtered = filtered.filter((g) => g.derivedStatus === "new");
  else if (filterStatus === "in_review")
    filtered = filtered.filter((g) => g.derivedStatus === "in_review");

  filtered.sort((a, b) => (a.fetchedAt < b.fetchedAt ? 1 : -1));

  // Include selected id so its details still render even if filter excludes it.
  const visibleIds = Array.from(
    new Set(filtered.map((g) => g.productId).concat(sp.id ? [sp.id] : [])),
  );
  const productMap = new Map<string, ProductRow>();
  if (visibleIds.length > 0) {
    const { data: prods } = await admin
      .from("products")
      .select(
        "id, name, slug, status, product_line:product_lines(name, slug)",
      )
      .in("id", visibleIds);
    for (const r of (prods ?? []) as ProductRow[]) productMap.set(r.id, r);
  }

  // Selected stays "sticky" -- even if filter no longer includes it (user
  // started reviewing, status changed to in_review while on New tab). The
  // selected card is rendered at top of the list so they don't lose it.
  const selectedExistsAnywhere =
    sp.id && allGroups.some((g) => g.productId === sp.id);
  const selectedId = selectedExistsAnywhere
    ? sp.id!
    : filtered[0]?.productId;

  const filteredWithSticky = selectedExistsAnywhere
    ? filtered.some((g) => g.productId === sp.id)
      ? filtered
      : [
          withStatus.find((g) => g.productId === sp.id)!,
          ...filtered,
        ]
    : filtered;

  let detailContent: React.ReactNode = (
    <div className="ah-prop-empty">No proposals in this view.</div>
  );

  if (selectedId) {
    const selected = productMap.get(selectedId);
    if (selected) {
      const selectedGroup = filtered.find((g) => g.productId === selectedId);
      const selectedLine = getOne(selected.product_line);
      const productProps = allProps.filter(
        (p) => p.product_id === selectedId,
      );
      // Group images by source; tamashii (official) always first, then
      // other sources alphabetical, preserving original order within each.
      const SOURCE_RANK: Record<string, number> = {
        tamashii: 0,
        goodsmile: 1,
        megahouse: 2,
        fandom: 3,
        ebay: 4,
      };
      const productImgs = allImgs
        .filter((i) => i.product_id === selectedId)
        .slice()
        .sort((a, b) => {
          const ra = SOURCE_RANK[a.proposed_by_source] ?? 99;
          const rb = SOURCE_RANK[b.proposed_by_source] ?? 99;
          if (ra !== rb) return ra - rb;
          return a.proposed_by_source.localeCompare(b.proposed_by_source);
        });

      const pending = productProps.filter((p) => p.status === "pending");
      const approved = productProps.filter((p) => p.status === "approved");
      const rejected = productProps.filter((p) => p.status === "rejected");

      const readiness =
        selected.status === "draft"
          ? await getPublishReadiness(selected.id)
          : null;

      detailContent = (
        <div className="ah-prop-detail-inner">
          <div className="ah-prop-detail-head">
            <div>
              <div className="ah-prop-detail-tag">
                {selected.status === "draft" && (
                  <span className="ah-tag ah-tag--draft">NEW DRAFT</span>
                )}
                {selectedGroup?.derivedStatus === "new" &&
                  selected.status !== "draft" && (
                    <span className="ah-tag ah-tag--new">NEW</span>
                  )}
                <span className="ah-small ah-dim">
                  {selectedLine?.name ?? ""}
                </span>
              </div>
              <h2 className="ah-prop-detail-title">{selected.name}</h2>
            </div>
            <div className="ah-prop-detail-actions">
              <Link
                href={`/admin/products/${selected.id}`}
                className="ah-btn ah-btn--ghost"
              >
                Edit product
              </Link>
            </div>
          </div>

          {readiness && (
            <PublishPanel
              productId={selected.id}
              initialReadiness={readiness}
            />
          )}

          {(pending.length > 0 || productImgs.length > 0) && (
            <div className="ah-prop-bulk">
              <form
                action={async () => {
                  "use server";
                  await approveAllForProduct(selected.id);
                }}
              >
                <button className="ah-btn ah-btn--ok-ghost">
                  Approve all fields
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await rejectAllForProduct(selected.id);
                }}
              >
                <button className="ah-btn">Discard all fields</button>
              </form>
              <div style={{ flex: 1 }} />
              <form
                action={async () => {
                  "use server";
                  await discardEverythingForProduct(selected.id);
                }}
              >
                <button className="ah-btn ah-btn--danger-ghost">
                  Discard everything
                </button>
              </form>
            </div>
          )}

          <div className="ah-section-head">
            <h3 className="ah-h3">Field proposals</h3>
            <span className="ah-small ah-dim">
              {approved.length} approved · {rejected.length} discarded ·{" "}
              {pending.length} pending
            </span>
          </div>

          <div className="ah-field-list">
            {productProps.length === 0 ? (
              <div className="ah-list-empty">No field proposals.</div>
            ) : (
              productProps.map((p) => <FieldCard key={p.id} proposal={p} />)
            )}
          </div>

          {productImgs.length > 0 && (
            <>
              <div className="ah-section-head">
                <h3 className="ah-h3">Image candidates</h3>
                <span className="ah-small ah-dim">
                  {productImgs.length} found · approve to keep
                </span>
              </div>
              <div className="ah-img-grid">
                {productImgs.map((img) => (
                  <ImageCard key={img.id} img={img} />
                ))}
              </div>
            </>
          )}
        </div>
      );
    }
  }

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">
          Proposals <span className="ah-h1-count">({allGroups.length})</span>
        </h1>
      </div>

      <div className="ah-prop-layout">
        <aside className="ah-prop-list">
          <div className="ah-prop-list-toolbar">
            <FilterTabs
              items={[
                { tab: "all", label: "All", count: counts.all },
                { tab: "new", label: "New", count: counts.new },
                {
                  tab: "in_review",
                  label: "In review",
                  count: counts.in_review,
                },
              ]}
            />
          </div>
          <div className="ah-prop-list-scroll">
            {filteredWithSticky.length === 0 ? (
              <div className="ah-list-empty">Nothing here.</div>
            ) : (
              filteredWithSticky.map((g) => {
                const prod = productMap.get(g.productId);
                if (!prod) return null;
                const line = getOne(prod.product_line);
                return (
                  <PropListItem
                    key={g.productId}
                    productId={g.productId}
                    name={prod.name}
                    lineName={line?.name ?? null}
                    status={g.derivedStatus}
                    fieldCount={g.fieldCount}
                    imageCount={g.imageCount}
                    sources={Array.from(g.sources)}
                    confidence={g.avgConfidence}
                    fetchedAt={g.fetchedAt}
                  />
                );
              })
            )}
          </div>
        </aside>
        <section className="ah-prop-detail">{detailContent}</section>
      </div>
    </div>
  );
}

function FieldCard({ proposal }: { proposal: ProposalRow }) {
  const tier = confTier(proposal.confidence);
  const cls =
    proposal.status === "approved"
      ? "ah-field is-approved"
      : proposal.status === "rejected"
        ? "ah-field is-discarded"
        : "ah-field";
  return (
    <div className={cls}>
      <div className="ah-field-head">
        <div className="ah-field-meta">
          <span className="ah-tag ah-tag--key">{proposal.field}</span>
          <span className="ah-mono ah-dim">{proposal.source}</span>
          <span className={`ah-conf ah-conf--${tier}`}>
            <span className="ah-conf-track">
              <span
                className="ah-conf-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, proposal.confidence))}%`,
                }}
              />
            </span>
            <span className="ah-conf-label">{proposal.confidence}%</span>
          </span>
          {proposal.source_url && (
            <a
              href={proposal.source_url}
              target="_blank"
              rel="noreferrer"
              className="ah-link"
            >
              source ↗
            </a>
          )}
        </div>
        {proposal.status === "approved" && (
          <span className="ah-tag ah-tag--ok">APPROVED</span>
        )}
        {proposal.status === "rejected" && (
          <span className="ah-tag ah-tag--off">DISCARDED</span>
        )}
      </div>
      <div className="ah-field-diff">
        <div className="ah-field-col">
          <div className="ah-field-col-label">Current</div>
          <pre className="ah-field-val">{fmt(proposal.current_value)}</pre>
        </div>
        <div className="ah-field-col ah-field-col--proposed">
          <div className="ah-field-col-label">Proposed</div>
          {proposal.status === "pending" &&
          TEXT_EDITABLE.has(proposal.field) ? (
            <EditableProposed
              proposalId={proposal.id}
              initialValue={
                typeof proposal.proposed_value === "string"
                  ? proposal.proposed_value
                  : ""
              }
              editable
            />
          ) : (
            <pre className="ah-field-val">{fmt(proposal.proposed_value)}</pre>
          )}
        </div>
      </div>
      {proposal.notes && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "var(--ah-warn-bg)",
            color: "var(--ah-warn)",
            borderRadius: 4,
            fontSize: 12.5,
          }}
        >
          {proposal.notes}
        </div>
      )}
      {proposal.status === "pending" && (
        <div className="ah-field-actions">
          <form
            action={async () => {
              "use server";
              await approveFieldProposal(proposal.id);
            }}
          >
            <button className="ah-btn ah-btn--ok">Approve</button>
          </form>
          <form
            action={async () => {
              "use server";
              await rejectFieldProposal(proposal.id);
            }}
          >
            <button className="ah-btn">Discard</button>
          </form>
        </div>
      )}
    </div>
  );
}

function ImageCard({ img }: { img: ProposedImageRow }) {
  return (
    <div className={`ah-img${img.is_primary ? " is-approved" : ""}`}>
      <div className="ah-img-frame">
        <Image
          src={img.url}
          alt={img.alt ?? ""}
          width={400}
          height={400}
          unoptimized
        />
        <span
          className="ah-source-pill"
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            background: "rgba(0,0,0,0.65)",
            color: "white",
          }}
        >
          {img.proposed_by_source}
        </span>
      </div>
      <div className="ah-img-actions">
        <form
          action={async () => {
            "use server";
            await approveImageProposal(img.id, "primary");
          }}
        >
          <button
            className="ah-btn ah-btn--ok"
            style={{ fontSize: 12, padding: "4px 8px" }}
            title="Approve + set as primary image"
          >
            Set primary
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await approveImageProposal(img.id, "gallery");
          }}
        >
          <button
            className="ah-btn ah-btn--ok-ghost"
            style={{ fontSize: 12, padding: "4px 8px" }}
            title="Approve + keep in gallery"
          >
            Keep
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await rejectImageProposal(img.id);
          }}
        >
          <button
            type="submit"
            className="ah-link ah-link--danger"
            style={{ fontSize: 12, padding: "4px 8px" }}
          >
            Discard
          </button>
        </form>
      </div>
    </div>
  );
}
