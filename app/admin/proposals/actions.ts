"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { urlToStoragePath } from "@/lib/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_FIELDS = new Set([
  "description",
  "release_year",
  "tags",
  "price",
  "currency",
  "sku",
]);

function assertUuid(id: string, name: string): void {
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${name}`);
}

async function revalidateProductPaths(productId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function approveFieldProposal(id: string): Promise<void> {
  const user = await requireAdmin();
  assertUuid(id, "proposal id");
  const admin = createAdminClient();

  const { data: proposal, error } = await admin
    .from("crawl_proposals")
    .select("id, product_id, field, proposed_value, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const p = proposal as {
    id: string;
    product_id: string;
    field: string;
    proposed_value: unknown;
    status: string;
  } | null;
  if (!p) throw new Error("Proposal not found");
  if (p.status !== "pending") throw new Error("Proposal already decided");
  if (!ALLOWED_FIELDS.has(p.field))
    throw new Error(`Field not allowed: ${p.field}`);

  // Per-field shape check before writing to the products column.
  // proposed_value is a JSONB blob from the crawler — never trust the type.
  const v = p.proposed_value;
  const isStr = (x: unknown): x is string => typeof x === "string";
  const isFiniteNum = (x: unknown): x is number =>
    typeof x === "number" && Number.isFinite(x);
  switch (p.field) {
    case "description":
    case "sku":
      if (!isStr(v) || v.trim().length === 0)
        throw new Error(`Invalid ${p.field}: expected non-empty string`);
      break;
    case "release_year":
      if (!isFiniteNum(v) || !Number.isInteger(v) || v < 1900 || v > 2100)
        throw new Error("Invalid release_year: expected integer 1900-2100");
      break;
    case "price":
      if (!isFiniteNum(v) || v <= 0)
        throw new Error("Invalid price: expected positive number");
      break;
    case "currency":
      if (v !== "USD" && v !== "ARS")
        throw new Error("Invalid currency: expected USD or ARS");
      break;
    case "tags":
      if (!Array.isArray(v) || !v.every(isStr))
        throw new Error("Invalid tags: expected string[]");
      break;
    default:
      throw new Error(`Unhandled field: ${p.field}`);
  }

  // Write proposed value back to products.
  const update: Record<string, unknown> = { [p.field]: p.proposed_value };
  const { error: upErr } = await admin
    .from("products")
    .update(update)
    .eq("id", p.product_id);
  if (upErr) throw upErr;

  const { error: markErr } = await admin
    .from("crawl_proposals")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq("id", id);
  if (markErr) throw markErr;

  await revalidateProductPaths(p.product_id);
}

// In-place edit of a pending proposal's proposed_value. Lets the admin
// massage Tamashii spec / Fandom narrative / their own text before
// approving. Free-text only — numeric / array fields aren't editable
// through this path (admin sets those on the product edit page).
export async function updateProposedValue(
  id: string,
  newValue: string,
): Promise<void> {
  await requireAdmin();
  assertUuid(id, "proposal id");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("crawl_proposals")
    .select("product_id, field, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    product_id: string;
    field: string;
    status: string;
  } | null;
  if (!row) throw new Error("Proposal not found");
  if (row.status !== "pending") throw new Error("Proposal already decided");
  if (!ALLOWED_FIELDS.has(row.field))
    throw new Error(`Field not editable: ${row.field}`);
  // Only text-shaped fields are editable here; numbers / arrays go
  // through the regular product edit form.
  if (!["description", "sku"].includes(row.field))
    throw new Error(`Field ${row.field} is not text-editable`);

  const trimmed = newValue.trim();
  if (trimmed.length === 0) throw new Error("Empty value");
  if (trimmed.length > 8000) throw new Error("Value too long (max 8000)");

  const { error: upErr } = await admin
    .from("crawl_proposals")
    .update({ proposed_value: trimmed })
    .eq("id", id);
  if (upErr) throw upErr;

  await revalidateProductPaths(row.product_id);
}

// Hard-discard: deletes the proposal row entirely. Used to be a soft
// "rejected" status flip; the user wants a clean slate so re-running the
// crawler can re-propose without colliding with the unique-pending index.
export async function rejectFieldProposal(id: string): Promise<void> {
  await requireAdmin();
  assertUuid(id, "proposal id");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("crawl_proposals")
    .select("product_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as { product_id: string } | null;
  if (!row) throw new Error("Proposal not found");

  const { error: delErr } = await admin
    .from("crawl_proposals")
    .delete()
    .eq("id", id);
  if (delErr) throw delErr;

  await revalidateProductPaths(row.product_id);
}

export async function approveAllForProduct(productId: string): Promise<void> {
  await requireAdmin();
  assertUuid(productId, "product id");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("crawl_proposals")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "pending");
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    await approveFieldProposal(row.id);
  }
}

export async function rejectAllForProduct(productId: string): Promise<void> {
  await requireAdmin();
  assertUuid(productId, "product id");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("crawl_proposals")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "pending");
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    await rejectFieldProposal(row.id);
  }
}

// ---------- image proposals ----------

export async function approveImageProposal(
  imageId: string,
  mode: "primary" | "gallery",
): Promise<void> {
  await requireAdmin();
  assertUuid(imageId, "image id");
  if (mode !== "primary" && mode !== "gallery")
    throw new Error("Invalid mode");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("product_images")
    .select("id, product_id, proposed_by_source")
    .eq("id", imageId)
    .maybeSingle();
  if (error) throw error;
  const img = data as {
    id: string;
    product_id: string;
    proposed_by_source: string | null;
  } | null;
  if (!img) throw new Error("Image not found");
  if (img.proposed_by_source == null)
    throw new Error("Image is not a crawler proposal");

  // Clear `proposed_by_source` so it shows as an accepted image.
  const update: Record<string, unknown> = { proposed_by_source: null };
  if (mode === "primary") {
    update.is_primary = true;
    const { error: clearErr } = await admin
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", img.product_id)
      .neq("id", img.id);
    if (clearErr) throw clearErr;
  }
  const { error: upErr } = await admin
    .from("product_images")
    .update(update)
    .eq("id", img.id);
  if (upErr) throw upErr;

  await revalidateProductPaths(img.product_id);
}

export async function rejectImageProposal(imageId: string): Promise<void> {
  await requireAdmin();
  assertUuid(imageId, "image id");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("product_images")
    .select("id, product_id, url, proposed_by_source")
    .eq("id", imageId)
    .maybeSingle();
  if (error) throw error;
  const img = data as {
    id: string;
    product_id: string;
    url: string;
    proposed_by_source: string | null;
  } | null;
  if (!img) throw new Error("Image not found");
  if (img.proposed_by_source == null)
    throw new Error("Image is not a crawler proposal");

  const path = urlToStoragePath(img.url);
  if (path) await admin.storage.from("product-images").remove([path]);
  const { error: delErr } = await admin
    .from("product_images")
    .delete()
    .eq("id", img.id);
  if (delErr) throw delErr;

  await revalidateProductPaths(img.product_id);
}

// Inline price setter used by the Publish panel. Lets the admin set
// price + currency without leaving the proposal page.
export async function setProductPrice(
  productId: string,
  price: number,
  currency: "USD" | "ARS",
): Promise<{ ok: true } | { ok: false; reason: string }> {
  await requireAdmin();
  assertUuid(productId, "product id");
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: "Price must be a positive number" };
  }
  if (price > 10_000_000) {
    return { ok: false, reason: "Price unreasonably large" };
  }
  if (currency !== "USD" && currency !== "ARS") {
    return { ok: false, reason: "Invalid currency" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .update({ price, currency })
    .eq("id", productId);
  if (error) {
    console.error("setProductPrice failed", error);
    return { ok: false, reason: "Could not save price" };
  }
  await revalidateProductPaths(productId);
  return { ok: true };
}

// Publish a draft product to the storefront. Validates that the basics
// are in place (real price, an approved primary image) before flipping
// the status. Returns a structured result so the UI can surface the
// specific reason instead of a generic toast.
export type PublishCheck = {
  ok: boolean;
  hasPrice: boolean;
  hasName: boolean;
  hasPrimaryImage: boolean;
  hasDescription: boolean;
  pendingProposals: number;
  pendingImageCandidates: number;
};

export async function getPublishReadiness(
  productId: string,
): Promise<PublishCheck> {
  await requireAdmin();
  assertUuid(productId, "product id");
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("price, name, description, status")
    .eq("id", productId)
    .maybeSingle();
  const p = product as {
    price: number | string | null;
    name: string | null;
    description: string | null;
    status: string;
  } | null;
  if (!p) throw new Error("Product not found");

  const [primaryRes, candRes, propRes] = await Promise.all([
    admin
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("is_primary", true)
      .is("proposed_by_source", null),
    admin
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .not("proposed_by_source", "is", null),
    admin
      .from("crawl_proposals")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("status", "pending"),
  ]);

  const hasPrice = p.price != null && Number(p.price) > 0;
  const hasName = Boolean(p.name && p.name.trim().length > 0);
  const hasPrimaryImage = (primaryRes.count ?? 0) > 0;
  const hasDescription = Boolean(p.description && p.description.trim().length > 0);
  return {
    ok: hasPrice && hasName && hasPrimaryImage,
    hasPrice,
    hasName,
    hasPrimaryImage,
    hasDescription,
    pendingProposals: propRes.count ?? 0,
    pendingImageCandidates: candRes.count ?? 0,
  };
}

export async function publishDraftProduct(
  productId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  await requireAdmin();
  assertUuid(productId, "product id");
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("status")
    .eq("id", productId)
    .maybeSingle();
  const p = product as { status: string } | null;
  if (!p) return { ok: false, reason: "Product not found" };
  if (p.status !== "draft") {
    return { ok: false, reason: `Product is not a draft (status=${p.status})` };
  }

  const readiness = await getPublishReadiness(productId);
  if (!readiness.ok) {
    const reasons: string[] = [];
    if (!readiness.hasPrice) reasons.push("price must be > 0");
    if (!readiness.hasName) reasons.push("name is required");
    if (!readiness.hasPrimaryImage)
      reasons.push("at least one approved primary image is required");
    return { ok: false, reason: reasons.join("; ") };
  }

  const { error } = await admin
    .from("products")
    .update({ status: "available" })
    .eq("id", productId);
  if (error) {
    console.error("publishDraftProduct failed", error);
    return { ok: false, reason: "Could not publish — check the server logs" };
  }

  await revalidateProductPaths(productId);
  return { ok: true };
}

// Nuke everything pending for a product: deletes every pending field
// proposal + every crawler-uploaded image (storage objects + DB rows).
// Manual uploads (proposed_by_source IS NULL) are preserved.
export async function discardEverythingForProduct(
  productId: string,
): Promise<void> {
  await requireAdmin();
  assertUuid(productId, "product id");
  const admin = createAdminClient();

  // 1. Collect image storage paths so we can purge them in one batch.
  const { data: imgs, error: imgErr } = await admin
    .from("product_images")
    .select("id, url")
    .eq("product_id", productId)
    .not("proposed_by_source", "is", null);
  if (imgErr) throw imgErr;
  const imageRows = (imgs ?? []) as Array<{ id: string; url: string }>;

  const paths = imageRows
    .map((r) => urlToStoragePath(r.url))
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await admin.storage.from("product-images").remove(paths);
  }

  if (imageRows.length > 0) {
    const { error: delImgErr } = await admin
      .from("product_images")
      .delete()
      .in(
        "id",
        imageRows.map((r) => r.id),
      );
    if (delImgErr) throw delImgErr;
  }

  // 2. Drop every pending proposal row for the product. Approved /
  // already-rejected rows stay so the audit history is preserved.
  const { error: delPropErr } = await admin
    .from("crawl_proposals")
    .delete()
    .eq("product_id", productId)
    .eq("status", "pending");
  if (delPropErr) throw delPropErr;

  await revalidateProductPaths(productId);
}
