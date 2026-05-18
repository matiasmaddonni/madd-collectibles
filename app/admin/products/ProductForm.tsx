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
    .replace(/[̀-ͯ]/g, "")
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

  // Series are global since migration 010 (product_line_id is nullable).
  // Show ALL series in the dropdown; only fall back to a line-scoped
  // filter when the legacy column happens to be set AND matches the
  // currently selected line (kept for backwards compat).
  const filteredSeries = series;

  const action = isEdit ? updateProduct : createProduct;

  return (
    <form action={action} className="ah-form-grid">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label="Name" full>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="ah-input"
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
          className="ah-input"
        />
      </Field>

      <Field label="SKU">
        <input
          name="sku"
          defaultValue={initial.sku ?? ""}
          className="ah-input"
        />
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
          className="ah-input"
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
          className="ah-input"
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
          className="ah-input"
        />
      </Field>

      <Field label="Cost Price">
        <input
          name="cost_price"
          type="number"
          step="0.01"
          defaultValue={initial.cost_price ?? ""}
          className="ah-input"
        />
      </Field>

      <Field label="Currency">
        <select
          name="currency"
          defaultValue={initial.currency ?? "ARS"}
          className="ah-input"
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
          className="ah-input"
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
          className="ah-input"
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
          className="ah-input"
        />
      </Field>

      <Field label="Release Year">
        <input
          name="release_year"
          type="number"
          defaultValue={initial.release_year ?? ""}
          className="ah-input"
        />
      </Field>

      <Field label="Featured" full>
        <label className="ah-checkbox-row">
          <input
            type="checkbox"
            name="is_featured"
            defaultChecked={initial.is_featured}
          />
          Mark as featured
        </label>
      </Field>

      <Field label="Description" full>
        <textarea
          name="description"
          rows={4}
          defaultValue={initial.description ?? ""}
          className="ah-input"
        />
      </Field>

      <Field label="Tags (comma-separated)" full>
        <input
          name="tags"
          defaultValue={(initial.tags ?? []).join(", ")}
          className="ah-input"
        />
      </Field>

      <div className="ah-form-field--full" style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <button type="submit" className="ah-btn ah-btn--primary">
          {isEdit ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`ah-form-field${full ? " ah-form-field--full" : ""}`}>
      <span className="ah-form-label">{label}</span>
      {children}
    </label>
  );
}
