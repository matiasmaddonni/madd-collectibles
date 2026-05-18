import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm, type LineOpt, type SeriesOpt } from "../ProductForm";
import { ProductImagesEditor, type ImageRow } from "../ProductImagesEditor";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const [productRes, linesRes, seriesRes, imagesRes] = await Promise.all([
    admin.from("products").select("*").eq("id", id).single(),
    admin.from("product_lines").select("id, name, slug").order("sort_order"),
    admin.from("series").select("id, name, product_line_id").order("sort_order"),
    admin
      .from("product_images")
      .select("id, url, is_primary, sort_order")
      .eq("product_id", id)
      .order("sort_order"),
  ]);

  if (productRes.error || !productRes.data) notFound();

  const product = productRes.data as unknown as {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    product_line_id: string;
    series_id: string | null;
    price: number | string;
    cost_price: number | string | null;
    currency: "ARS" | "USD";
    condition: string;
    status: string;
    stock_qty: number;
    is_featured: boolean;
    release_year: number | null;
    description: string | null;
    tags: string[];
  };

  const lines = (linesRes.data ?? []) as unknown as LineOpt[];
  const series = (seriesRes.data ?? []) as unknown as SeriesOpt[];
  const images = (imagesRes.data ?? []) as unknown as ImageRow[];

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">Edit: {product.name}</h1>
        <Link href="/admin/products" className="ah-link">
          ← Back to products
        </Link>
      </div>

      <ProductForm initial={product} lines={lines} series={series} />

      <hr className="ah-divider" />

      <ProductImagesEditor
        productId={product.id}
        productSlug={product.slug}
        images={images}
      />
    </div>
  );
}
