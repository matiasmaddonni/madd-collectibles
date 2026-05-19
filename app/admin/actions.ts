"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, requireAdmin } from "@/lib/auth";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// Server-side admin sign-in. Goes through Postgres rate limit so brute-force
// attempts share state across serverless instances, and the email is checked
// against ADMIN_EMAILS before the session is allowed to persist. If the user
// is authenticated but not an admin, signs them out immediately.
export type SignInResult = { ok: true; next: string } | { ok: false; error: string };

export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const nextRaw = (formData.get("next") as string | null) ?? "/admin";

  if (!email || !password) return { ok: false, error: "Email + password required" };

  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]!.trim() : h.get("x-real-ip") ?? "unknown";

  const admin = createAdminClient();
  // Two-key rate limit: per-IP (10/5min) defends shared infra, per-email
  // (5/15min) defends an individual admin account from a rotating-IP
  // botnet. RPC errors fail CLOSED -- a flaky limiter must not become a
  // bypass.
  const emailKey = email.toLowerCase().slice(0, 320);
  const [{ data: ipAllowed, error: ipErr }, { data: emailAllowed, error: emErr }] =
    await Promise.all([
      admin.rpc("rate_limit_check", {
        p_bucket: "admin_signin",
        p_key: ip,
        p_window_seconds: 300,
        p_max: 10,
      }),
      admin.rpc("rate_limit_check", {
        p_bucket: "admin_signin_email",
        p_key: emailKey,
        p_window_seconds: 900,
        p_max: 5,
      }),
    ]);
  if (ipErr) console.error("rate_limit_check (ip) failed; failing closed", ipErr);
  if (emErr) console.error("rate_limit_check (email) failed; failing closed", emErr);
  if (ipErr || emErr || ipAllowed === false || emailAllowed === false) {
    return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  if (!isAdminEmail(email)) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not authorised." };
  }

  const safeNext =
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//") &&
    !nextRaw.startsWith("/\\")
      ? nextRaw
      : "/admin";

  return { ok: true, next: safeNext };
}

// ---------- products ----------

type ProductPayload = {
  id?: string;
  name: string;
  slug: string;
  sku: string | null;
  product_line_id: string;
  series_id: string | null;
  price: number;
  cost_price: number | null;
  currency: "ARS" | "USD";
  condition: string;
  status: string;
  stock_qty: number;
  is_featured: boolean;
  release_year: number | null;
  description: string | null;
  tags: string[];
};

const SLUG_RE = /^[a-z0-9-]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONDITIONS = new Set([
  "mint_sealed",
  "mint_open",
  "near_mint",
  "good",
  "fair",
]);
const STATUSES = new Set(["draft", "available", "reserved", "sold"]);

function parseProductForm(fd: FormData): ProductPayload {
  const num = (k: string): number | null => {
    const v = fd.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
  };
  const numReq = (k: string): number => {
    const n = num(k);
    if (n == null) throw new Error(`${k} required`);
    return n;
  };
  const intMin = (k: string, min: number, fallback: number): number => {
    const n = num(k);
    if (n == null) return fallback;
    return Math.max(min, Math.floor(n));
  };
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const tagsRaw = (fd.get("tags") as string) ?? "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  const slug = (fd.get("slug") as string | null) ?? "";
  if (!SLUG_RE.test(slug)) throw new Error("Invalid slug");

  const productLineId = (fd.get("product_line_id") as string | null) ?? "";
  if (!UUID_RE.test(productLineId)) throw new Error("Invalid product_line_id");

  const seriesIdRaw = str("series_id");
  if (seriesIdRaw != null && !UUID_RE.test(seriesIdRaw))
    throw new Error("Invalid series_id");

  const currency = (fd.get("currency") as string) || "ARS";
  if (currency !== "ARS" && currency !== "USD")
    throw new Error("Invalid currency");

  const condition = (fd.get("condition") as string) ?? "";
  if (!CONDITIONS.has(condition)) throw new Error("Invalid condition");

  const status = (fd.get("status") as string) ?? "";
  if (!STATUSES.has(status)) throw new Error("Invalid status");

  const releaseYear = num("release_year");
  if (releaseYear != null && (releaseYear < 1900 || releaseYear > 2100))
    throw new Error("Invalid release_year");

  const price = numReq("price");
  if (price < 0) throw new Error("price must be >= 0");
  const costPrice = num("cost_price");
  if (costPrice != null && costPrice < 0)
    throw new Error("cost_price must be >= 0");

  return {
    id: (fd.get("id") as string) || undefined,
    name: (fd.get("name") as string) ?? "",
    slug,
    sku: str("sku"),
    product_line_id: productLineId,
    series_id: seriesIdRaw,
    price,
    cost_price: costPrice,
    currency,
    condition,
    status,
    stock_qty: intMin("stock_qty", 0, 1),
    is_featured: fd.get("is_featured") === "on",
    release_year: releaseYear == null ? null : Math.floor(releaseYear),
    description: str("description"),
    tags,
  };
}

export async function createProduct(fd: FormData) {
  await requireAdmin();
  const payload = parseProductForm(fd);
  const { id: _id, ...insert } = payload;
  void _id;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .insert(insert as never)
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (payload.slug) revalidatePath(`/products/${payload.slug}`);
  redirect(`/admin/products/${(data as { id: string }).id}`);
}

export async function updateProduct(fd: FormData) {
  await requireAdmin();
  const payload = parseProductForm(fd);
  if (!payload.id || !UUID_RE.test(payload.id)) throw new Error("Missing id");
  const { id, ...update } = payload;
  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .update(update as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (payload.slug) revalidatePath(`/products/${payload.slug}`);
}

// Lean partial update for inline edits (price / status / condition). Avoids
// re-running parseProductForm, which expects the full edit form payload.
const PATCH_STATUSES = new Set(["draft", "available", "reserved", "sold"]);
const PATCH_CONDITIONS = new Set([
  "mint_sealed",
  "mint_open",
  "near_mint",
  "good",
  "fair",
]);
export async function patchProduct(fd: FormData) {
  await requireAdmin();
  const id = fd.get("id") as string;
  if (!id || !UUID_RE.test(id)) throw new Error("Invalid id");
  const update: Record<string, unknown> = {};
  const rawStatus = fd.get("status");
  if (typeof rawStatus === "string" && rawStatus) {
    if (!PATCH_STATUSES.has(rawStatus)) throw new Error("Invalid status");
    update.status = rawStatus;
  }
  const rawCondition = fd.get("condition");
  if (typeof rawCondition === "string" && rawCondition) {
    if (!PATCH_CONDITIONS.has(rawCondition)) throw new Error("Invalid condition");
    update.condition = rawCondition;
  }
  const rawPrice = fd.get("price");
  if (typeof rawPrice === "string" && rawPrice !== "") {
    const n = Number(rawPrice);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid price");
    update.price = n;
  }
  if (Object.keys(update).length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("products").update(update).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/catalogo");
}

export async function deleteProduct(fd: FormData) {
  await requireAdmin();
  const id = fd.get("id") as string;
  if (!id || !UUID_RE.test(id)) throw new Error("Missing id");
  const admin = createAdminClient();

  const { data: imgs } = await admin
    .from("product_images")
    .select("url")
    .eq("product_id", id);
  const imgRows = (imgs ?? []) as unknown as { url: string }[];
  if (imgRows.length > 0) {
    const paths = imgRows
      .map((i) => urlToStoragePath(i.url))
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await admin.storage.from("product-images").remove(paths);
    }
  }

  const { data: prod } = await admin
    .from("products")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const slug = (prod as { slug?: string } | null)?.slug;

  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (slug) revalidatePath(`/products/${slug}`);
}

// ---------- product images ----------

function urlToStoragePath(url: string): string | null {
  const marker = "/storage/v1/object/public/product-images/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}

const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

// Magic-byte sniff. Defends against a client-supplied content-type that
// lies (".jpg" wrapper around a binary). Reads the first 16 bytes and
// matches the well-known signature for each format. Returns the inferred
// mime, or null if no allowed signature matches.
function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  // WebP: "RIFF" + 4 bytes size + "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  // AVIF: ISOBMFF box "ftyp" at offset 4, brand "avif" or "avis" at 8
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70 &&
    buf[8] === 0x61 &&
    buf[9] === 0x76 &&
    buf[10] === 0x69 &&
    (buf[11] === 0x66 || buf[11] === 0x73)
  )
    return "image/avif";
  return null;
}

async function callAddImage(
  productId: string,
  url: string,
  isPrimary: boolean,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("add_product_image", {
    p_product_id: productId,
    p_url: url,
    p_is_primary: isPrimary,
  });
  if (error) throw error;
  return data as string;
}

export async function recordProductImage(input: {
  productId: string;
  url: string;
  isPrimary: boolean;
}) {
  await requireAdmin();
  if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
  await callAddImage(input.productId, input.url, input.isPrimary);
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/");
}

export async function uploadProductImage(fd: FormData) {
  await requireAdmin();
  const productId = fd.get("productId") as string;
  const productSlug = fd.get("productSlug") as string;
  const isPrimary = fd.get("isPrimary") === "true";
  const file = fd.get("file") as File | null;
  if (!productId || !file) throw new Error("productId + file required");
  if (!UUID_RE.test(productId)) throw new Error("Invalid productId");
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > 15 * 1024 * 1024) throw new Error("File over 15 MB");
  if (/^image\/(heic|heif)$/i.test(file.type)) {
    throw new Error(
      "HEIC images can't be displayed on the web. On iPhone go to Settings → Cámara → Formatos → Más compatible, or convert the photo to JPEG before uploading.",
    );
  }
  if (!/^image\/(jpeg|png|webp|avif)$/i.test(file.type)) {
    throw new Error(
      `Unsupported image type "${file.type || "unknown"}". Use JPEG, PNG, WEBP, or AVIF.`,
    );
  }

  const admin = createAdminClient();
  // productSlug used only as a human-friendly folder name. Validate it
  // strictly so an attacker can't traverse out of the bucket prefix
  // (e.g. "../other-product"). If invalid, fall back to productId.
  const folder =
    productSlug && SLUG_RE.test(productSlug) ? productSlug : productId;
  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ext = ALLOWED_IMAGE_EXTS.has(rawExt) ? rawExt : "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${folder}/${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());

  // Verify the bytes match the declared content-type. Client mime header
  // is trivially spoofable; the file header is not. Mismatch rejects the
  // upload outright -- protects storage from arbitrary blobs disguised
  // as images.
  const sniffed = sniffImageMime(buf.subarray(0, 16));
  if (!sniffed) {
    throw new Error(
      "File contents don't look like a supported image (JPEG, PNG, WEBP, or AVIF).",
    );
  }
  if (sniffed !== file.type.toLowerCase()) {
    throw new Error(
      `File header (${sniffed}) doesn't match the declared type (${file.type || "unknown"}). Re-export the image and try again.`,
    );
  }

  const { error: upErr } = await admin.storage
    .from("product-images")
    .upload(path, buf, {
      cacheControl: "3600",
      contentType: sniffed,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data: pub } = admin.storage
    .from("product-images")
    .getPublicUrl(path);

  await callAddImage(productId, pub.publicUrl, isPrimary);

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (productSlug && SLUG_RE.test(productSlug))
    revalidatePath(`/products/${productSlug}`);
}

async function slugForProduct(productId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle();
  return (data as { slug?: string } | null)?.slug ?? null;
}

export async function setPrimaryImage(input: {
  productId: string;
  imageId: string;
}) {
  await requireAdmin();
  if (!UUID_RE.test(input.productId) || !UUID_RE.test(input.imageId))
    throw new Error("Invalid id");
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_primary_product_image", {
    p_product_id: input.productId,
    p_image_id: input.imageId,
  });
  if (error) throw error;
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  const slug = await slugForProduct(input.productId);
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function deleteProductImage(input: {
  productId: string;
  imageId: string;
  url: string;
}) {
  await requireAdmin();
  if (!UUID_RE.test(input.productId) || !UUID_RE.test(input.imageId))
    throw new Error("Invalid id");
  const admin = createAdminClient();
  const path = urlToStoragePath(input.url);
  if (path) await admin.storage.from("product-images").remove([path]);
  const { error } = await admin
    .from("product_images")
    .delete()
    .eq("id", input.imageId);
  if (error) throw error;
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  const slug = await slugForProduct(input.productId);
  if (slug) revalidatePath(`/products/${slug}`);
}

// ---------- brands ----------

export async function upsertBrand(fd: FormData) {
  await requireAdmin();
  const id = (fd.get("id") as string) || null;
  const name = (fd.get("name") as string) ?? "";
  const slug = (fd.get("slug") as string) ?? "";
  if (!name || !slug) throw new Error("name + slug required");
  if (!SLUG_RE.test(slug)) throw new Error("Invalid slug");
  const admin = createAdminClient();
  if (id) {
    if (!UUID_RE.test(id)) throw new Error("Invalid id");
    const { error } = await admin.from("brands").update({ name, slug }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("brands").insert({ name, slug, sort_order: 0 });
    if (error) throw error;
  }
  revalidatePath("/admin/brands");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

export async function deleteBrand(fd: FormData) {
  await requireAdmin();
  const id = fd.get("id") as string;
  if (!id || !UUID_RE.test(id)) throw new Error("Invalid id");
  const admin = createAdminClient();
  const { error } = await admin.from("brands").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/brands");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

// ---------- product_lines ----------

export async function upsertLine(fd: FormData) {
  await requireAdmin();
  const id = (fd.get("id") as string) || null;
  const name = (fd.get("name") as string) ?? "";
  const slug = (fd.get("slug") as string) ?? "";
  const brand_id = (fd.get("brand_id") as string) ?? "";
  if (!name || !slug || !brand_id) throw new Error("name + slug + brand_id required");
  if (!SLUG_RE.test(slug)) throw new Error("Invalid slug");
  if (!UUID_RE.test(brand_id)) throw new Error("Invalid brand_id");
  const admin = createAdminClient();
  if (id) {
    if (!UUID_RE.test(id)) throw new Error("Invalid id");
    const { error } = await admin.from("product_lines").update({ name, slug, brand_id }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("product_lines")
      .insert({ name, slug, brand_id, sort_order: 0 });
    if (error) throw error;
  }
  revalidatePath("/admin/product-lines");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

export async function deleteLine(fd: FormData) {
  await requireAdmin();
  const id = fd.get("id") as string;
  if (!id || !UUID_RE.test(id)) throw new Error("Invalid id");
  const admin = createAdminClient();
  const { error } = await admin.from("product_lines").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/product-lines");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

// ---------- series ----------

export async function upsertSeries(fd: FormData) {
  await requireAdmin();
  const id = (fd.get("id") as string) || null;
  const name = (fd.get("name") as string) ?? "";
  const slug = (fd.get("slug") as string) ?? "";
  const product_line_id = (fd.get("product_line_id") as string) ?? "";
  if (!name || !slug || !product_line_id)
    throw new Error("name + slug + product_line_id required");
  if (!SLUG_RE.test(slug)) throw new Error("Invalid slug");
  if (!UUID_RE.test(product_line_id)) throw new Error("Invalid product_line_id");
  const admin = createAdminClient();
  if (id) {
    if (!UUID_RE.test(id)) throw new Error("Invalid id");
    const { error } = await admin
      .from("series")
      .update({ name, slug, product_line_id })
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("series")
      .insert({ name, slug, product_line_id, sort_order: 0 });
    if (error) throw error;
  }
  revalidatePath("/admin/series");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

export async function deleteSeries(fd: FormData) {
  await requireAdmin();
  const id = fd.get("id") as string;
  if (!id || !UUID_RE.test(id)) throw new Error("Invalid id");
  const admin = createAdminClient();
  const { error } = await admin.from("series").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/series");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}
