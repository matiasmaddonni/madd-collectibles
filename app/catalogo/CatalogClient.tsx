"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

type PendingCtx = { pending: boolean; setPending: (v: boolean) => void };
const CatalogPendingContext = createContext<PendingCtx>({
  pending: false,
  setPending: () => {},
});

export function CatalogPendingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const params = useSearchParams();
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRunRef = useRef(true);

  // Reset pending whenever params actually change (server response landed)
  useEffect(() => {
    setPending(false);
  }, [params]);

  // Debounced filter analytics — coalesce rapid filter toggles into one event.
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      const line = params.get("linea") ?? undefined;
      const series = params.get("serie") ?? undefined;
      const availability = params.get("condicion") ?? undefined;
      // Skip empty no-op events (no filters at all).
      if (!line && !series && !availability) return;
      trackEvent("catalog_filter_apply", { line, series, availability });
    }, 500);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [params]);

  const value = useMemo(() => ({ pending, setPending }), [pending]);
  return (
    <CatalogPendingContext.Provider value={value}>
      {children}
    </CatalogPendingContext.Provider>
  );
}

function usePublishPending(isPending: boolean) {
  const { setPending } = useContext(CatalogPendingContext);
  useEffect(() => {
    if (isPending) setPending(true);
  }, [isPending, setPending]);
}

export function CatalogResultsArea({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pending } = useContext(CatalogPendingContext);
  return (
    <div
      aria-busy={pending}
      className={`transition-opacity duration-300 ${
        pending ? "opacity-50 animate-pulse pointer-events-none" : "opacity-100"
      }`}
    >
      {children}
    </div>
  );
}

export type LineFacet = { slug: string; name: string; count: number };
export type SeriesFacet = { slug: string; name: string; count: number };
export type ConditionFacet = { value: string; label: string; count: number };

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "reciente", label: "Más reciente" },
  { value: "antiguo", label: "Más antiguo" },
  { value: "precio-asc", label: "Precio ↑" },
  { value: "precio-desc", label: "Precio ↓" },
  { value: "nombre-asc", label: "Nombre A–Z" },
  { value: "nombre-desc", label: "Nombre Z–A" },
];

function buildHref(
  current: URLSearchParams,
  patch: Record<string, string | null>,
  resetPage = true,
): string {
  const next = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  if (resetPage) next.delete("pagina");
  const s = next.toString();
  return s ? `?${s}` : "";
}

function toggleCsv(value: string, token: string): string {
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const idx = parts.indexOf(token);
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(token);
  return parts.join(",");
}

function csvList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type PanelProps = {
  lines: LineFacet[];
  series: SeriesFacet[];
  conditions: ConditionFacet[];
  pathname: string;
};

function FilterPanel({ lines, series, conditions, pathname }: PanelProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  usePublishPending(isPending);

  const selectedLines = csvList(params.get("linea"));
  const selectedSeries = csvList(params.get("serie"));
  const selectedConditions = csvList(params.get("condicion"));
  const min = params.get("min") ?? "";
  const max = params.get("max") ?? "";

  const [minVal, setMinVal] = useState(min);
  const [maxVal, setMaxVal] = useState(max);

  useEffect(() => {
    setMinVal(min);
    setMaxVal(max);
  }, [min, max]);

  const push = (patch: Record<string, string | null>) => {
    const href = pathname + buildHref(params, patch);
    startTransition(() => router.push(href, { scroll: false }));
  };

  const onToggleLine = (slug: string) => {
    const next = toggleCsv(params.get("linea") ?? "", slug);
    push({ linea: next || null });
  };
  const onToggleSeries = (slug: string) => {
    const next = toggleCsv(params.get("serie") ?? "", slug);
    push({ serie: next || null });
  };
  const onToggleCondition = (value: string) => {
    const next = toggleCsv(params.get("condicion") ?? "", value);
    push({ condicion: next || null });
  };
  const applyPrice = () => {
    push({
      min: minVal && Number(minVal) > 0 ? minVal : null,
      max: maxVal && Number(maxVal) > 0 ? maxVal : null,
    });
  };

  const clearAll = () => {
    startTransition(() => router.push(pathname, { scroll: false }));
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
          Filtros
        </span>
        <button
          type="button"
          onClick={clearAll}
          className="font-mono text-[10px] uppercase tracked-wide text-text-secondary hover:text-accent transition-colors"
        >
          Limpiar
        </button>
      </header>

      <FilterGroup label="Línea">
        {lines.map((l) => (
          <CheckRow
            key={l.slug}
            checked={selectedLines.includes(l.slug)}
            onChange={() => onToggleLine(l.slug)}
            label={l.name}
            count={l.count}
          />
        ))}
        {lines.length === 0 && (
          <span className="font-body text-xs text-text-secondary">—</span>
        )}
      </FilterGroup>

      <FilterGroup label="Serie">
        {series.map((s) => (
          <CheckRow
            key={s.slug}
            checked={selectedSeries.includes(s.slug)}
            onChange={() => onToggleSeries(s.slug)}
            label={s.name}
            count={s.count}
          />
        ))}
        {series.length === 0 && (
          <span className="font-body text-xs text-text-secondary">—</span>
        )}
      </FilterGroup>

      <FilterGroup label="Condición">
        {conditions.map((c) => (
          <CheckRow
            key={c.value}
            checked={selectedConditions.includes(c.value)}
            onChange={() => onToggleCondition(c.value)}
            label={c.label}
            count={c.count}
          />
        ))}
        {conditions.length === 0 && (
          <span className="font-body text-xs text-text-secondary">—</span>
        )}
      </FilterGroup>

      <FilterGroup label="Precio">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Mín"
            value={minVal}
            onChange={(e) => setMinVal(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="w-full bg-bg-deep border border-border-subtle px-2 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
          />
          <span className="font-mono text-xs text-text-secondary">—</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Máx"
            value={maxVal}
            onChange={(e) => setMaxVal(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="w-full bg-bg-deep border border-border-subtle px-2 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-[11px] uppercase tracked-wide text-text-secondary">
        {label}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <span className="flex items-center gap-2.5 min-w-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="w-3.5 h-3.5 accent-accent"
        />
        <span className="font-body text-sm text-text-primary truncate group-hover:text-accent transition-colors">
          {label}
        </span>
      </span>
      <span className="font-mono text-[10px] text-text-secondary">
        {count}
      </span>
    </label>
  );
}

export function CatalogSidebar({
  lines,
  series,
  conditions,
}: {
  lines: LineFacet[];
  series: SeriesFacet[];
  conditions: ConditionFacet[];
}) {
  const pathname = usePathname();
  return (
    <FilterPanel
      lines={lines}
      series={series}
      conditions={conditions}
      pathname={pathname}
    />
  );
}

export function CatalogActiveChips({
  lines,
  series,
  conditions,
}: {
  lines: LineFacet[];
  series: SeriesFacet[];
  conditions: ConditionFacet[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  usePublishPending(isPending);

  const lineMap = new Map(lines.map((l) => [l.slug, l.name]));
  const seriesMap = new Map(series.map((s) => [s.slug, s.name]));
  const condMap = new Map(conditions.map((c) => [c.value, c.label]));

  const chips: { key: string; label: string; remove: () => void }[] = [];

  csvList(params.get("linea")).forEach((slug) => {
    chips.push({
      key: `linea:${slug}`,
      label: lineMap.get(slug) ?? slug,
      remove: () => {
        const next = toggleCsv(params.get("linea") ?? "", slug);
        const href = pathname + buildHref(params, { linea: next || null });
        startTransition(() => router.push(href, { scroll: false }));
      },
    });
  });
  csvList(params.get("serie")).forEach((slug) => {
    chips.push({
      key: `serie:${slug}`,
      label: seriesMap.get(slug) ?? slug,
      remove: () => {
        const next = toggleCsv(params.get("serie") ?? "", slug);
        const href = pathname + buildHref(params, { serie: next || null });
        startTransition(() => router.push(href, { scroll: false }));
      },
    });
  });
  csvList(params.get("condicion")).forEach((value) => {
    chips.push({
      key: `condicion:${value}`,
      label: condMap.get(value) ?? value,
      remove: () => {
        const next = toggleCsv(params.get("condicion") ?? "", value);
        const href =
          pathname + buildHref(params, { condicion: next || null });
        startTransition(() => router.push(href, { scroll: false }));
      },
    });
  });
  const min = params.get("min");
  const max = params.get("max");
  if (min || max) {
    const label = `${min ? `US$ ${min}` : "—"} – ${max ? `US$ ${max}` : "—"}`;
    chips.push({
      key: "price",
      label,
      remove: () => {
        const href =
          pathname + buildHref(params, { min: null, max: null });
        startTransition(() => router.push(href, { scroll: false }));
      },
    });
  }
  const q = params.get("q");
  if (q) {
    chips.push({
      key: "q",
      label: `"${q}"`,
      remove: () => {
        const href = pathname + buildHref(params, { q: null });
        startTransition(() => router.push(href, { scroll: false }));
      },
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracked-wide px-2.5 py-1 border border-border-subtle bg-bg-surface text-text-primary hover:border-accent hover:text-accent transition-colors"
        >
          {c.label}
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

export function CatalogSort() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  usePublishPending(isPending);
  const current = params.get("orden") ?? "reciente";

  return (
    <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracked-wide text-text-secondary">
      Ordenar
      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          const href =
            pathname +
            buildHref(params, {
              orden: next === "reciente" ? null : next,
            });
          startTransition(() => router.push(href, { scroll: false }));
        }}
        className="bg-bg-deep border border-border-subtle text-text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-accent"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PendingLink({
  href,
  children,
  className,
  ariaCurrent,
  ariaDisabled,
  scroll = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  ariaCurrent?: "page";
  ariaDisabled?: boolean;
  scroll?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  usePublishPending(isPending);

  return (
    <a
      href={href}
      aria-current={ariaCurrent}
      aria-disabled={ariaDisabled}
      onClick={(e) => {
        if (ariaDisabled) {
          e.preventDefault();
          return;
        }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        startTransition(() => {
          router.push(href, { scroll });
          if (scroll && typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        });
      }}
      className={className}
    >
      {children}
    </a>
  );
}

export function MobileFilterTrigger({
  lines,
  series,
  conditions,
}: {
  lines: LineFacet[];
  series: SeriesFacet[];
  conditions: ConditionFacet[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center gap-2 font-mono text-[11px] uppercase tracked-wide px-3 py-2 border border-border-subtle text-text-primary hover:border-accent hover:text-accent transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18M6 12h12M10 18h4" />
        </svg>
        Filtros
      </button>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Filtros"
        className={`fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] bg-bg-surface border-t border-border-subtle flex flex-col transition-transform duration-300 md:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            Filtros
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar filtros"
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>
        <div className="px-6 py-6 overflow-y-auto">
          <FilterPanel
            lines={lines}
            series={series}
            conditions={conditions}
            pathname={pathname}
          />
        </div>
        <footer className="border-t border-border-subtle px-6 py-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cta-primary w-full inline-flex items-center justify-center px-5 h-11 rounded-sm font-mono uppercase tracked-wide text-sm text-text-primary"
          >
            Ver resultados
          </button>
        </footer>
      </aside>
    </>
  );
}
