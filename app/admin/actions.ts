"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
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

function parseProductForm(fd: FormData): ProductPayload {
  const num = (k: string) => {
    const v = fd.get(k);
    if (v == null || v === "") return null;
    return Number(v);
  };
  const numReq = (k: string) => {
    const n = num(k);
    if (n == null) throw new Error(`${k} required`);
    return n;
  };
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const tagsRaw = (fd.get("tags") as string) ?? "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    id: (fd.get("id") as string) || undefined,
    name: fd.get("name") as string,
    slug: fd.get("slug") as string,
    sku: str("sku"),
    product_line_id: fd.get("product_line_id") as string,
    series_id: str("series_id"),
    price: numReq("price"),
    cost_price: num("cost_price"),
    currency: ((fd.get("currency") as string) || "ARS") as "ARS" | "USD",
    condition: fd.get("condition") as string,
    status: fd.get("status") as string,
    stock_qty: num("stock_qty") ?? 1,
    is_featured: fd.get("is_featured") === "on",
    release_year: num("release_year"),
    description: str("description"),
    tags,
  };
}

export async function createProduct(fd: FormData) {
  await requireUser();
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
  await requireUser();
  const payload = parseProductForm(fd);
  if (!payload.id) throw new Error("Missing id");
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

export async function deleteProduct(fd: FormData) {
  await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");
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

  // Capture slug before delete so we can revalidate the public detail page.
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

export async function recordProductImage(input: {
  productId: string;
  url: string;
  isPrimary: boolean;
}) {
  await requireUser();
  const admin = createAdminClient();
  if (input.isPrimary) {
    await admin
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", input.productId);
  }
  const { data: existing } = await admin
    .from("product_images")
    .select("sort_order")
    .eq("product_id", input.productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const existingRows = (existing ?? []) as unknown as { sort_order: number }[];
  const nextSort = existingRows.length > 0 ? existingRows[0].sort_order + 1 : 0;
  const { error } = await admin.from("product_images").insert({
    product_id: input.productId,
    url: input.url,
    is_primary: input.isPrimary,
    sort_order: nextSort,
  });
  if (error) throw error;
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/");
}

export async function uploadProductImage(fd: FormData) {
  await requireUser();
  const productId = fd.get("productId") as string;
  const productSlug = fd.get("productSlug") as string;
  const isPrimary = fd.get("isPrimary") === "true";
  const file = fd.get("file") as File | null;
  if (!productId || !file) throw new Error("productId + file required");
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > 15 * 1024 * 1024) throw new Error("File over 15 MB");
  // HEIC / HEIF (default iPhone camera format) is not renderable in most
  // browsers — surface a clear, actionable error instead of a generic one.
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
  const folder = productSlug || productId;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${folder}/${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from("product-images")
    .upload(path, buf, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data: pub } = admin.storage
    .from("product-images")
    .getPublicUrl(path);

  if (isPrimary) {
    await admin
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);
  }
  const { data: existing } = await admin
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const existingRows = (existing ?? []) as unknown as { sort_order: number }[];
  const nextSort = existingRows.length > 0 ? existingRows[0].sort_order + 1 : 0;

  const { error: insErr } = await admin.from("product_images").insert({
    product_id: productId,
    url: pub.publicUrl,
    is_primary: isPrimary,
    sort_order: nextSort,
  });
  if (insErr) throw insErr;

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (productSlug) revalidatePath(`/products/${productSlug}`);
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
  await requireUser();
  const admin = createAdminClient();
  await admin
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", input.productId);
  const { error } = await admin
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", input.imageId);
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
  await requireUser();
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
  await requireUser();
  const id = (fd.get("id") as string) || null;
  const name = fd.get("name") as string;
  const slug = fd.get("slug") as string;
  if (!name || !slug) throw new Error("name + slug required");
  const admin = createAdminClient();
  if (id) {
    const { error } = await admin.from("brands").update({ name, slug }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("brands").insert({ name, slug, sort_order: 0 });
    if (error) throw error;
  }
  revalidatePath("/admin/brands");
}

export async function deleteBrand(fd: FormData) {
  await requireUser();
  const id = fd.get("id") as string;
  const admin = createAdminClient();
  const { error } = await admin.from("brands").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/brands");
}

// ---------- product_lines ----------

export async function upsertLine(fd: FormData) {
  await requireUser();
  const id = (fd.get("id") as string) || null;
  const name = fd.get("name") as string;
  const slug = fd.get("slug") as string;
  const brand_id = fd.get("brand_id") as string;
  if (!name || !slug || !brand_id) throw new Error("name + slug + brand_id required");
  const admin = createAdminClient();
  if (id) {
    const { error } = await admin.from("product_lines").update({ name, slug, brand_id }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("product_lines")
      .insert({ name, slug, brand_id, sort_order: 0 });
    if (error) throw error;
  }
  revalidatePath("/admin/product-lines");
}

export async function deleteLine(fd: FormData) {
  await requireUser();
  const id = fd.get("id") as string;
  const admin = createAdminClient();
  const { error } = await admin.from("product_lines").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/product-lines");
}

// ---------- series ----------

export async function upsertSeries(fd: FormData) {
  await requireUser();
  const id = (fd.get("id") as string) || null;
  const name = fd.get("name") as string;
  const slug = fd.get("slug") as string;
  const product_line_id = fd.get("product_line_id") as string;
  if (!name || !slug || !product_line_id)
    throw new Error("name + slug + product_line_id required");
  const admin = createAdminClient();
  if (id) {
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
}

export async function deleteSeries(fd: FormData) {
  await requireUser();
  const id = fd.get("id") as string;
  const admin = createAdminClient();
  const { error } = await admin.from("series").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/series");
}
