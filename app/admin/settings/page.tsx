import { createAdminClient } from "@/lib/supabase/admin";
import {
  upsertBrand,
  deleteBrand,
  upsertLine,
  deleteLine,
  upsertSeries,
  deleteSeries,
} from "../actions";
import { SubNav } from "./SubNav";
import { TaxonomyEditor, type Column } from "./TaxonomyEditor";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };
type Tab = "brands" | "lines" | "series";
const validTabs: Tab[] = ["brands", "lines", "series"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const tab: Tab = (validTabs as string[]).includes(sp.tab ?? "")
    ? (sp.tab as Tab)
    : "brands";

  const admin = createAdminClient();
  const [brandsRes, linesRes, seriesRes] = await Promise.all([
    admin.from("brands").select("id, name, slug").order("sort_order").order("name"),
    admin
      .from("product_lines")
      .select("id, name, slug, brand_id")
      .order("sort_order")
      .order("name"),
    admin
      .from("series")
      .select("id, name, slug, product_line_id")
      .order("sort_order")
      .order("name"),
  ]);

  const brands = (brandsRes.data ?? []) as Array<{ id: string; name: string; slug: string }>;
  const lines = (linesRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    brand_id: string;
  }>;
  const series = (seriesRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    product_line_id: string;
  }>;

  return (
    <div className="ah-page">
      <div className="ah-page-title">
        <h1 className="ah-h1">Settings</h1>
      </div>

      <SubNav
        items={[
          { tab: "brands", label: "Brands", count: brands.length },
          { tab: "lines", label: "Lines", count: lines.length },
          { tab: "series", label: "Series", count: series.length },
        ]}
      />

      {tab === "brands" && (
        <TaxonomyEditor
          title="Brands"
          sub="inline edit, save per row"
          addLabel="Add new brand"
          deleteConfirmKey="name"
          columns={brandColumns}
          rows={brands}
          upsertAction={upsertBrand}
          deleteAction={deleteBrand}
        />
      )}

      {tab === "lines" && (
        <TaxonomyEditor
          title="Product lines"
          sub="inline edit, save per row"
          addLabel="Add new line"
          deleteConfirmKey="name"
          columns={lineColumns(brands)}
          rows={lines}
          upsertAction={upsertLine}
          deleteAction={deleteLine}
        />
      )}

      {tab === "series" && (
        <TaxonomyEditor
          title="Series"
          sub="inline edit, save per row"
          addLabel="Add new series"
          deleteConfirmKey="name"
          columns={seriesColumns(lines)}
          rows={series}
          upsertAction={upsertSeries}
          deleteAction={deleteSeries}
        />
      )}
    </div>
  );
}

const brandColumns: Column[] = [
  { key: "name", label: "Name" },
  { key: "slug", label: "Slug" },
];

function lineColumns(
  brands: Array<{ id: string; name: string }>,
): Column[] {
  return [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    {
      key: "brand_id",
      label: "Brand",
      type: "select",
      options: brands.map((b) => ({ value: b.id, label: b.name })),
    },
  ];
}

function seriesColumns(
  lines: Array<{ id: string; name: string }>,
): Column[] {
  return [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    {
      key: "product_line_id",
      label: "Line",
      type: "select",
      options: lines.map((l) => ({ value: l.id, label: l.name })),
    },
  ];
}
