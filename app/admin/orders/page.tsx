import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { formatRelative } from "../products/_components/relativeTime";
import { OrderActions } from "./OrderActions";
import { OrderPricingForm } from "./OrderPricingForm";

export const dynamic = "force-dynamic";

type IntentItem = {
  id: string;
  slug: string | null;
  name: string;
  lineName?: string;
  price: number;
  salePrice?: number | null;
  currency: "ARS" | "USD";
  qty: number;
};

type OrderStatus = "pending" | "approved" | "cancelled";

type IntentRow = {
  id: string;
  created_at: string;
  items: IntentItem[];
  totals: Record<string, number>;
  status?: OrderStatus;
  decided_at?: string | null;
};

type SearchParams = { status?: string };
const TABS: Array<{ key: "pending" | "approved" | "cancelled" | "all"; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const STATUS_TAG: Record<OrderStatus, { cls: string; label: string }> = {
  pending: { cls: "ah-tag--new", label: "PENDING" },
  approved: { cls: "ah-tag--ok", label: "APPROVED" },
  cancelled: { cls: "ah-tag--off", label: "CANCELLED" },
};

function fmtTotals(totals: Record<string, number>): string {
  const parts = Object.entries(totals)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([cur, amt]) => formatPrice(amt, cur as "ARS" | "USD"));
  return parts.length > 0 ? parts.join(" + ") : "—";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const active = (["pending", "approved", "cancelled", "all"] as const).includes(
    sp.status as never,
  )
    ? (sp.status as "pending" | "approved" | "cancelled" | "all")
    : "pending";

  const admin = createAdminClient();
  // select("*") tolerates the pre-migration-015 schema (no status column);
  // rows without status are treated as pending.
  const { data } = await admin
    .from("checkout_intents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as IntentRow[]).map((r) => ({
    ...r,
    status: (r.status ?? "pending") as OrderStatus,
  }));

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    all: rows.length,
  };

  const visible =
    active === "all" ? rows : rows.filter((r) => r.status === active);

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">
          Orders <span className="ah-h1-count">({counts.pending} pending)</span>
        </h1>
      </div>

      <nav className="ah-subnav">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?status=${t.key}`}
            className={`ah-subnav-item${active === t.key ? " is-active" : ""}`}
          >
            {t.label}
            <span className="ah-subnav-count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="ah-card">
          <div className="ah-list-empty">No orders in this view.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((order) => {
            const tag = STATUS_TAG[order.status];
            const itemCount = (order.items ?? []).reduce(
              (n, i) => n + (i.qty || 1),
              0,
            );
            return (
              <section key={order.id} className="ah-card" style={{ marginBottom: 0 }}>
                <div className="ah-card-head">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`ah-tag ${tag.cls}`}>{tag.label}</span>
                      <span className="ah-card-title">
                        {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                        {fmtTotals(order.totals)}
                      </span>
                    </div>
                    <div className="ah-card-sub">
                      {formatRelative(order.created_at)}
                      {order.decided_at
                        ? ` · decided ${formatRelative(order.decided_at)}`
                        : ""}
                    </div>
                  </div>
                  {order.status === "pending" && (
                    <OrderActions intentId={order.id} />
                  )}
                </div>

                {order.status === "pending" ? (
                  <OrderPricingForm
                    intentId={order.id}
                    items={order.items ?? []}
                  />
                ) : (
                  <div className="ah-list">
                    {(order.items ?? []).map((it, i) => {
                      const sale =
                        it.salePrice != null && it.salePrice !== it.price
                          ? it.salePrice
                          : null;
                      return (
                        <div key={`${it.id}-${i}`} className="ah-list-row">
                          <div>
                            <div className="ah-list-name">
                              {it.slug ? (
                                <Link
                                  href={`/admin/products/${it.id}`}
                                  className="ah-row-name"
                                >
                                  {it.name}
                                </Link>
                              ) : (
                                it.name
                              )}
                              {it.qty > 1 ? ` ×${it.qty}` : ""}
                            </div>
                            {it.lineName && (
                              <div className="ah-list-sub">{it.lineName}</div>
                            )}
                          </div>
                          <div
                            className="ah-list-meta"
                            style={{ display: "flex", gap: 10, alignItems: "center" }}
                          >
                            {sale != null ? (
                              <>
                                <span
                                  style={{
                                    color: "var(--ah-text-3)",
                                    textDecoration: "line-through",
                                    fontSize: 12,
                                  }}
                                >
                                  {formatPrice(it.price, it.currency)}
                                </span>
                                <span>{formatPrice(sale, it.currency)}</span>
                              </>
                            ) : (
                              <span>{formatPrice(it.price, it.currency)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
