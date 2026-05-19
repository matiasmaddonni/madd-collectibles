"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, EMAIL_TO, getResend } from "@/lib/email";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/env";

type IntentItem = {
  id: string;
  slug: string | null;
  name: string;
  lineName: string;
  price: number;
  currency: "ARS" | "USD";
  qty: number;
};

type IntentInput = {
  items: IntentItem[];
  totals: Record<string, number>;
};

const MAX_ITEMS = 50;
const MAX_NAME = 200;
// 5 intents per IP per 60s. Backed by the rate_limit_check Postgres RPC so the
// limit is consistent across serverless instances (in-process Maps reset on
// every cold start and don't share state across regions).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function rateLimitOk(ip: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rate_limit_check", {
    p_bucket: "checkout_intent",
    p_key: ip,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max: RATE_LIMIT_MAX,
  });
  if (error) {
    // Fail closed: a flaky RPC must not become a bypass for the limiter.
    console.error("rate_limit_check failed; failing closed", error);
    return false;
  }
  return data === true;
}

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

function originAllowed(h: Headers): boolean {
  // Server Actions add an `origin` header. Block calls from any other origin —
  // defends the action from being driven by a foreign site or a curl client.
  const origin = h.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(SITE_URL).origin;
  } catch {
    return false;
  }
}

function sanitize(input: unknown): IntentInput | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : null;
  const totals = obj.totals && typeof obj.totals === "object" ? obj.totals : null;
  if (!items || !totals) return null;
  if (items.length === 0 || items.length > MAX_ITEMS) return null;

  const cleanItems: IntentItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.slice(0, 64) : null;
    const slug = typeof r.slug === "string" ? r.slug.slice(0, 200) : null;
    const name = typeof r.name === "string" ? r.name.slice(0, MAX_NAME) : null;
    const lineName = typeof r.lineName === "string" ? r.lineName.slice(0, MAX_NAME) : "";
    const price = typeof r.price === "number" && isFinite(r.price) ? r.price : null;
    const currency = r.currency === "USD" || r.currency === "ARS" ? r.currency : null;
    const qty =
      typeof r.qty === "number" && Number.isInteger(r.qty) && r.qty > 0 && r.qty <= 999
        ? r.qty
        : null;
    if (!id || !name || price == null || !currency || qty == null) return null;
    cleanItems.push({ id, slug, name, lineName, price, currency, qty });
  }

  const cleanTotals: Record<string, number> = {};
  for (const [k, v] of Object.entries(totals)) {
    if ((k === "ARS" || k === "USD") && typeof v === "number" && isFinite(v)) {
      cleanTotals[k] = v;
    }
  }

  return { items: cleanItems, totals: cleanTotals };
}

function renderEmail(intent: IntentInput, intentId: string): { subject: string; html: string; text: string } {
  const lines = intent.items
    .map(
      (i) =>
        `• ${i.name} ×${i.qty} — ${formatPrice(i.price * i.qty, i.currency)}`,
    )
    .join("\n");
  const totalsStr = Object.entries(intent.totals)
    .map(([cur, amt]) => formatPrice(amt, cur as "ARS" | "USD"))
    .join(" + ");

  const subject = `Nuevo intento de checkout — ${intent.items.length} figura(s)`;
  const text = `Intent ${intentId}\n\n${lines}\n\nTotal: ${totalsStr}`;
  const htmlLines = intent.items
    .map(
      (i) =>
        `<li><strong>${escapeHtml(i.name)}</strong> ×${i.qty} — ${escapeHtml(
          formatPrice(i.price * i.qty, i.currency),
        )}</li>`,
    )
    .join("");
  const html = `
    <div style="font-family:system-ui,sans-serif">
      <h2>Nuevo intento de checkout</h2>
      <p style="color:#666;font-size:12px">Intent ID: ${escapeHtml(intentId)}</p>
      <ul>${htmlLines}</ul>
      <p><strong>Total:</strong> ${escapeHtml(totalsStr)}</p>
    </div>
  `;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ProductRow = {
  id: string;
  slug: string | null;
  name: string;
  price: number | string;
  currency: "ARS" | "USD";
  status: "draft" | "available" | "reserved" | "sold";
  stock_qty: number | null;
  product_line:
    | { name: string }
    | { name: string }[]
    | null;
};

function getLineName(rel: ProductRow["product_line"]): string {
  if (!rel) return "";
  const one = Array.isArray(rel) ? rel[0] : rel;
  return one?.name ?? "";
}

// Re-validate the client-supplied cart against the database. Returns a
// VerifiedIntent the server fully owns: prices, names, line names, totals
// all come from the products table, not the cart payload. Aborts when any
// item is missing, unavailable, or out of stock — the customer is bounced
// back to fix their cart instead of submitting a stale order.
async function verifyAgainstDb(
  client: IntentInput,
): Promise<{ ok: true; data: IntentInput } | { ok: false; error: string }> {
  const ids = Array.from(new Set(client.items.map((i) => i.id)));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(
      "id, slug, name, price, currency, status, stock_qty, product_line:product_lines(name)",
    )
    .in("id", ids);
  if (error || !data) {
    console.error("checkout: product lookup failed", error);
    return { ok: false, error: "lookup failed" };
  }
  const rows = data as unknown as ProductRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const verifiedItems: IntentItem[] = [];
  const totals: Record<string, number> = {};

  for (const it of client.items) {
    const p = byId.get(it.id);
    if (!p) return { ok: false, error: "item not found" };
    if (p.status !== "available" || (p.stock_qty ?? 0) <= 0) {
      return { ok: false, error: `"${p.name}" no longer available` };
    }
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: `"${p.name}" has no price set` };
    }
    verifiedItems.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      lineName: getLineName(p.product_line),
      price,
      currency: p.currency,
      qty: it.qty,
    });
    totals[p.currency] = (totals[p.currency] ?? 0) + price * it.qty;
  }

  return { ok: true, data: { items: verifiedItems, totals } };
}

export async function recordCheckoutIntent(
  raw: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const client = sanitize(raw);
  if (!client) return { ok: false, error: "invalid payload" };

  const h = await headers();
  if (!originAllowed(h)) {
    return { ok: false, error: "forbidden origin" };
  }
  const ip = clientIp(h);
  if (!(await rateLimitOk(ip))) {
    return { ok: false, error: "rate limited" };
  }

  // Re-derive prices + totals from the products table. Client-supplied
  // price / currency / lineName / name are now ignored everywhere
  // downstream: no $1-for-$1000-figure tampering possible.
  const verified = await verifyAgainstDb(client);
  if (!verified.ok) return verified;
  const data = verified.data;

  const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;
  const referrer = h.get("referer")?.slice(0, 500) ?? null;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("checkout_intents")
    .insert({
      items: data.items,
      totals: data.totals,
      user_agent: userAgent,
      referrer,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("checkout_intents insert failed", error);
    return { ok: false, error: "persist failed" };
  }

  const id = (inserted as { id: string }).id;

  const resend = getResend();
  if (resend) {
    try {
      const { subject, html, text } = renderEmail(data, id);
      await resend.emails.send({
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject,
        html,
        text,
      });
      await admin
        .from("checkout_intents")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", id);
    } catch (err) {
      console.error("resend send failed", err);
    }
  }

  return { ok: true, id };
}
