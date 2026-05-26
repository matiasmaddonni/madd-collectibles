"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IntentItem = {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  currency: "ARS" | "USD";
  qty: number;
};

type ProductLite = {
  stock_qty: number | null;
  status: "draft" | "available" | "reserved" | "sold";
};

type ActionResult = { ok: true } | { ok: false; reason: string };

function revalidateOrderPaths(slugs: string[]): void {
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/catalogo");
  for (const slug of slugs) {
    if (slug) revalidatePath(`/products/${slug}`);
  }
}

// Approve a WhatsApp order: flip every product in the intent to `sold`
// (sold_at is set by the products trigger), then mark the intent
// approved. Items already sold are skipped — re-approving or a
// double-order doesn't error. Products that no longer exist are ignored.
export async function approveOrder(intentId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!UUID_RE.test(intentId)) return { ok: false, reason: "Invalid id" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("checkout_intents")
    .select("id, items, status")
    .eq("id", intentId)
    .maybeSingle();
  if (error) {
    console.error("approveOrder lookup failed", error);
    return { ok: false, reason: "Lookup failed" };
  }
  const intent = data as
    | { id: string; items: IntentItem[]; status: string }
    | null;
  if (!intent) return { ok: false, reason: "Order not found" };
  if (intent.status !== "pending")
    return { ok: false, reason: `Order already ${intent.status}` };

  const slugs = (intent.items ?? [])
    .map((i) => i.slug)
    .filter((s): s is string => Boolean(s));

  // Per-item decrement: when stock_qty after the sale is still > 0, leave
  // status='available' and just lower the count. Only flip to status='sold'
  // when the buyer takes the last unit — that's when sold_at should fire.
  // Already-sold rows are skipped (re-approve / replay safe).
  const items = (intent.items ?? []).filter(
    (i) => typeof i.id === "string" && UUID_RE.test(i.id),
  );
  for (const item of items) {
    const qty = Number.isFinite(item.qty) && item.qty > 0 ? Math.floor(item.qty) : 1;
    const { data: prod, error: getErr } = await admin
      .from("products")
      .select("stock_qty, status")
      .eq("id", item.id)
      .maybeSingle();
    if (getErr) {
      console.error("approveOrder fetch failed", item.id, getErr);
      return { ok: false, reason: "Could not read product stock" };
    }
    const p = prod as ProductLite | null;
    if (!p) continue;
    if (p.status === "sold") continue;
    const current = p.stock_qty ?? 0;
    const next = current - qty;
    const update: { stock_qty: number; status?: "sold" } =
      next <= 0 ? { stock_qty: 0, status: "sold" } : { stock_qty: next };
    const { error: upErr } = await admin
      .from("products")
      .update(update)
      .eq("id", item.id);
    if (upErr) {
      console.error("approveOrder product update failed", item.id, upErr);
      return { ok: false, reason: "Could not update stock" };
    }
  }

  const { error: markErr } = await admin
    .from("checkout_intents")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq("id", intentId);
  if (markErr) {
    console.error("approveOrder mark failed", markErr);
    return { ok: false, reason: "Items sold but order not marked — retry" };
  }

  revalidateOrderPaths(slugs);
  return { ok: true };
}

// Cancel an order without touching inventory.
export async function cancelOrder(intentId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!UUID_RE.test(intentId)) return { ok: false, reason: "Invalid id" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("checkout_intents")
    .update({
      status: "cancelled",
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq("id", intentId)
    .eq("status", "pending");
  if (error) {
    console.error("cancelOrder failed", error);
    return { ok: false, reason: "Could not cancel" };
  }
  revalidateOrderPaths([]);
  return { ok: true };
}
