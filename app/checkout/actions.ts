"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, EMAIL_TO, getResend } from "@/lib/email";
import { formatPrice } from "@/lib/format";

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
// Per-IP rate limit: max RATE_LIMIT_MAX intents per RATE_LIMIT_WINDOW_MS.
// In-memory only — survives within a single warm serverless instance, resets
// on cold start. Best-effort defense against script abuse, not a hard guarantee.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
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

export async function recordCheckoutIntent(
  raw: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const data = sanitize(raw);
  if (!data) return { ok: false, error: "invalid payload" };

  const h = await headers();
  const ip = clientIp(h);
  if (!rateLimitOk(ip)) {
    return { ok: false, error: "rate limited" };
  }
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
