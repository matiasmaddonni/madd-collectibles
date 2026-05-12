"use client";

import { useState } from "react";
import { createProduct, updateProduct } from "../actions";

export type LineOpt = { id: string; name: string; slug: string };
export type SeriesOpt = {
  id: string;
  name: string;
  product_line_id: string;
};

export type ProductInitial = {
  id?: string;
  name?: string;
  slug?: string;
  sku?: string | null;
  product_line_id?: string;
  series_id?: string | null;
  price?: number | string;
  cost_price?: number | string | null;
  currency?: "ARS" | "USD";
  condition?: string;
  status?: string;
  stock_qty?: number;
  is_featured?: boolean;
  release_year?: number | null;
  description?: string | null;
  tags?: string[];
};

const CONDITIONS = ["mint_sealed", "mint_open", "near_mint", "good", "fair"];
const STATUSES = ["draft", "available", "reserved", "sold"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function ProductForm({
  initial,
  lines,
  series,
}: {
  initial: ProductInitial;
  lines: LineOpt[];
  series: SeriesOpt[];
}) {
  const isEdit = Boolean(initial.id);
  const [name, setName] = useState(initial.name ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [lineId, setLineId] = useState(initial.product_line_id ?? "");
  const [seriesId, setSeriesId] = useState(initial.series_id ?? "");

  const filteredSeries = lineId
    ? series.filter((s) => s.product_line_id === lineId)
    : [];

  const action = isEdit ? updateProduct : createProduct;

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label="Name" className="md:col-span-2">
        <input
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className={inputClass}
        />
      </Field>

      <Field label="Slug">
        <input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          className={inputClass}
        />
      </Field>

      <Field label="SKU">
        <input name="sku" defaultValue={initial.sku ?? ""} className={inputClass} />
      </Field>

      <Field label="Product Line">
        <select
          name="product_line_id"
          required
          value={lineId}
          onChange={(e) => {
            setLineId(e.target.value);
            setSeriesId("");
          }}
          className={inputClass}
        >
          <option value="">— select —</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Series">
        <select
          name="series_id"
          value={seriesId}
          onChange={(e) => setSeriesId(e.target.value)}
          className={inputClass}
          disabled={!lineId}
        >
          <option value="">— none —</option>
          {filteredSeries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Price">
        <input
          name="price"
          type="number"
          step="0.01"
          required
          defaultValue={initial.price ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Cost Price">
        <input
          name="cost_price"
          type="number"
          step="0.01"
          defaultValue={initial.cost_price ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Currency">
        <select
          name="currency"
          defaultValue={initial.currency ?? "ARS"}
          className={inputClass}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </Field>

      <Field label="Condition">
        <select
          name="condition"
          required
          defaultValue={initial.condition ?? "mint_sealed"}
          className={inputClass}
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Status">
        <select
          name="status"
          required
          defaultValue={initial.status ?? "available"}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Stock Qty">
        <input
          name="stock_qty"
          type="number"
          defaultValue={initial.stock_qty ?? 1}
          className={inputClass}
        />
      </Field>

      <Field label="Release Year">
        <input
          name="release_year"
          type="number"
          defaultValue={initial.release_year ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Featured" className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_featured"
            defaultChecked={initial.is_featured}
          />
          Mark as featured
        </label>
      </Field>

      <Field label="Description" className="md:col-span-2">
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Tags (comma-separated)" className="md:col-span-2">
        <input
          name="tags"
          defaultValue={(initial.tags ?? []).join(", ")}
          className={inputClass}
        />
      </Field>

      <div className="md:col-span-2 flex gap-3 mt-2">
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 text-sm"
        >
          {isEdit ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "border border-zinc-400 px-2 py-1 text-sm w-full bg-white text-black";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className}`}>
      <span className="text-zinc-700">{label}</span>
      {children}
    </label>
  );
}
