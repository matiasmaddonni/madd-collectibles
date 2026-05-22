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

  const ids = Array.from(
    new Set(
      (intent.items ?? [])
        .map((i) => i.id)
        .filter((id): id is string => typeof id === "string" && UUID_RE.test(id)),
    ),
  );

  const slugs = (intent.items ?? [])
    .map((i) => i.slug)
    .filter((s): s is string => Boolean(s));

  if (ids.length > 0) {
    // Only flip rows not already sold so sold_at reflects the first sale.
    const { error: upErr } = await admin
      .from("products")
      .update({ status: "sold" })
      .in("id", ids)
      .neq("status", "sold");
    if (upErr) {
      console.error("approveOrder product update failed", upErr);
      return { ok: false, reason: "Could not mark items sold" };
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
