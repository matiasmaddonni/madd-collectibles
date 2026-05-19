"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";

type Option = { value: string; label: string };

type Props = {
  resultCount: number;
  lineOptions: Option[];
  brandOptions: Option[];
  seriesOptions: Option[];
};

const STATUS_OPTIONS: Option[] = [
  { value: "draft", label: "Draft" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
];

export function Toolbar({
  resultCount,
  lineOptions,
  brandOptions,
  seriesOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const line = sp.get("line") ?? "";
  const brand = sp.get("brand") ?? "";
  const series = sp.get("series") ?? "";

  const [qLocal, setQLocal] = useState(q);
  // Mirror URL search param into the local controlled input — keeps the
  // input in sync when filters are cleared via "Clear" or the URL changes
  // externally (e.g. browser back).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQLocal(q);
  }, [q]);

  const push = (next: URLSearchParams) => {
    next.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  };

  useEffect(() => {
    if (qLocal === q) return;
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (qLocal) next.set("q", qLocal);
      else next.delete("q");
      push(next);
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  const anyActive = !!(q || status || line || brand || series);
  const clearAll = () => {
    const next = new URLSearchParams();
    push(next);
  };

  return (
    <div className="ah-toolbar">
      <div className="ah-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search by name..."
          value={qLocal}
          onChange={(e) => setQLocal(e.target.value)}
        />
        {qLocal && (
          <button
            type="button"
            className="ah-search-clear"
            onClick={() => setQLocal("")}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <FilterChip
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(v) => setParam("status", v)}
      />
      <FilterChip
        label="Line"
        value={line}
        options={lineOptions}
        onChange={(v) => setParam("line", v)}
      />
      <FilterChip
        label="Brand"
        value={brand}
        options={brandOptions}
        onChange={(v) => setParam("brand", v)}
      />
      <FilterChip
        label="Series"
        value={series}
        options={seriesOptions}
        onChange={(v) => setParam("series", v)}
      />

      {anyActive && (
        <button type="button" className="ah-btn ah-btn--ghost" onClick={clearAll}>
          Clear
        </button>
      )}

      <div className="ah-toolbar-spacer" />
      <span className="ah-toolbar-meta">{resultCount} results</span>
    </div>
  );
}

function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  const active = !!value;
  return (
    <label className={`ah-filter${active ? " is-active" : ""}`}>
      <span className="ah-filter-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
