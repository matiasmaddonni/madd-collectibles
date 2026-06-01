// First-party analytics ingest. The storefront posts here on every
// trackable event; the body shape mirrors lib/analytics.ts's typed
// event map. The route validates loosely (no PII, no SQL strings),
// hashes the IP with the UTC date so unique-visitor stats can be
// computed without storing PII, and inserts via the service role so
// the table itself stays locked behind RLS.

import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

// Allow-list of event names. Mirrors keys in lib/analytics.ts
// TrackEventMap + the new event types this batch adds.
const ALLOWED_EVENTS = new Set([
  "page_view",
  "page_dwell",
  "pdp_view",
  "add_to_cart",
  "remove_from_cart",
  "cart_open",
  "share_click",
  "social_outbound",
  "catalog_filter_apply",
  "whatsapp_click_product",
  "whatsapp_click_cart",
]);

// Cap how much arbitrary text any single event can carry, so a
// misbehaving client (or attacker) can't fill the DB with junk
// strings or props that bloat the row size.
const MAX_PROPS_BYTES = 2_000;
const MAX_STRING_LEN = 400;

function clipString(s: string): string {
  return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) : s;
}

// Recursive sanitiser — drops anything that isn't a JSON primitive,
// clips long strings, and bails out if the serialised payload would
// blow past the byte cap.
function sanitiseProps(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 64) continue;
    if (v === null) {
      out[k] = null;
    } else if (typeof v === "string") {
      out[k] = clipString(v);
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === "boolean") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v
        .filter((x) => typeof x === "string" || typeof x === "number")
        .slice(0, 20)
        .map((x) => (typeof x === "string" ? clipString(x) : x));
    }
    // Drop objects, functions, undefined, etc.
  }
  return out;
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function ipHashFor(req: Request): string | null {
  const ip = clientIp(req);
  if (!ip) return null;
  // Salting with the UTC date means the same visitor produces a
  // different hash tomorrow — daily-unique counts work, but
  // long-term correlation across days is not possible. No salt
  // rotation infra required.
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(ip + ":" + day)
    .digest("hex")
    .slice(0, 32);
}

type TrackBody = {
  event?: unknown;
  props?: unknown;
  session_id?: unknown;
  path?: unknown;
};

export async function POST(req: Request) {
  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return new Response(null, { status: 204 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED_EVENTS.has(event)) return new Response(null, { status: 204 });

  const sessionId =
    typeof body.session_id === "string" && body.session_id.length <= 64
      ? body.session_id
      : "";
  if (!sessionId) return new Response(null, { status: 204 });

  const path =
    typeof body.path === "string" ? clipString(body.path) : null;

  const props = sanitiseProps(body.props);
  const serialised = JSON.stringify(props);
  if (serialised.length > MAX_PROPS_BYTES) return new Response(null, { status: 204 });

  const ua = req.headers.get("user-agent");
  const ipHash = ipHashFor(req);

  try {
    const admin = createAdminClient();
    await admin.from("analytics_events").insert({
      event,
      props,
      session_id: sessionId,
      ip_hash: ipHash,
      path,
      user_agent: ua ? clipString(ua) : null,
    });
  } catch {
    // Swallow — analytics must never break the storefront.
  }
  // sendBeacon expects a tiny response; 204 keeps things cheap.
  return new Response(null, { status: 204 });
}
