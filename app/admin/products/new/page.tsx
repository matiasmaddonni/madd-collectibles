import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm, type LineOpt, type SeriesOpt } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const admin = createAdminClient();
  const [linesRes, seriesRes] = await Promise.all([
    admin.from("product_lines").select("id, name, slug").order("sort_order"),
    admin.from("series").select("id, name, product_line_id").order("sort_order"),
  ]);
  const lines = (linesRes.data ?? []) as unknown as LineOpt[];
  const series = (seriesRes.data ?? []) as unknown as SeriesOpt[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductForm initial={{}} lines={lines} series={series} />
    </div>
  );
}
