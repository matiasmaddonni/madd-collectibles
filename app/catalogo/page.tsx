import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/catalog/ProductCard";
import {
  getCatalogProducts,
  getCatalogFacets,
  type CatalogFilters,
} from "@/lib/queries";
import type { ProductCondition } from "@/lib/supabase/types";
import {
  CatalogSidebar,
  CatalogActiveChips,
  CatalogSort,
  MobileFilterTrigger,
  CatalogPendingProvider,
  CatalogResultsArea,
  PendingLink,
} from "./CatalogClient";

export const metadata: Metadata = {
  title: "Catálogo — MADD.",
  description:
    "Figuras Bandai originales: Myth Cloth, Myth Cloth EX, S.H.Figuarts y más. Filtrá por línea, condición y precio.",
};

const VALID_CONDITIONS: ProductCondition[] = [
  "mint_sealed",
  "mint_open",
  "near_mint",
  "good",
  "fair",
];

type SearchParams = Record<string, string | string[] | undefined>;

function csv(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(",") : v;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(v: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function str(v: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return undefined;
  return raw;
}

function parseFilters(sp: SearchParams): CatalogFilters {
  const sortRaw = str(sp.orden);
  const sort: CatalogFilters["sort"] =
    sortRaw === "precio-asc"
      ? "price-asc"
      : sortRaw === "precio-desc"
        ? "price-desc"
        : "newest";

  const conds = csv(sp.condicion).filter((c): c is ProductCondition =>
    VALID_CONDITIONS.includes(c as ProductCondition),
  );

  return {
    lineSlugs: csv(sp.linea),
    excludeLineSlugs: csv(sp.excluir),
    conditions: conds,
    minPrice: num(sp.min),
    maxPrice: num(sp.max),
    q: str(sp.q),
    sort,
    page: num(sp.pagina) ?? 1,
    perPage: 12,
  };
}

type PageProps = { searchParams: Promise<SearchParams> };

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [{ items, total, page, pageCount }, facets] = await Promise.all([
    getCatalogProducts(filters),
    getCatalogFacets(),
  ]);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
          <header className="flex flex-col gap-3 mb-8">
            <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
              Catálogo
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
              Todas las figuras
            </h1>
          </header>

          <Suspense fallback={null}>
            <CatalogPendingProvider>
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-10">
              <aside className="hidden md:block">
                <CatalogSidebar
                  lines={facets.lines}
                  conditions={facets.conditions}
                />
              </aside>

              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
                    {total} {total === 1 ? "figura encontrada" : "figuras encontradas"}
                  </span>
                  <div className="flex items-center gap-3">
                    <MobileFilterTrigger
                      lines={facets.lines}
                      conditions={facets.conditions}
                    />
                    <CatalogSort />
                  </div>
                </div>

                <CatalogActiveChips
                  lines={facets.lines}
                  conditions={facets.conditions}
                />

                <CatalogResultsArea>
                {items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((c) => (
                        <ProductCard key={c.id} card={c} />
                      ))}
                    </div>
                    {pageCount > 1 && (
                      <Pagination
                        page={page}
                        pageCount={pageCount}
                        currentParams={sp}
                      />
                    )}
                  </>
                )}
                </CatalogResultsArea>
              </div>
            </div>
            </CatalogPendingProvider>
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}

function EmptyState() {
  return (
    <div className="border border-border-subtle bg-bg-surface px-6 py-16 flex flex-col items-center gap-4 text-center">
      <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
        Sin resultados
      </span>
      <p className="font-body text-text-primary">
        No encontramos figuras con esos filtros.
      </p>
      <Link
        href="/catalogo"
        className="font-mono text-[11px] uppercase tracked-wide text-accent hover:underline"
      >
        Limpiar filtros
      </Link>
    </div>
  );
}

function buildPageHref(sp: SearchParams, page: number): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "pagina") continue;
    if (Array.isArray(v)) v.forEach((vv) => next.append(k, vv));
    else if (v) next.set(k, v);
  }
  if (page > 1) next.set("pagina", String(page));
  const s = next.toString();
  return s ? `/catalogo?${s}` : "/catalogo";
}

function Pagination({
  page,
  pageCount,
  currentParams,
}: {
  page: number;
  pageCount: number;
  currentParams: SearchParams;
}) {
  const prevHref = buildPageHref(currentParams, Math.max(1, page - 1));
  const nextHref = buildPageHref(currentParams, Math.min(pageCount, page + 1));

  const numbers: number[] = [];
  const window = 2;
  for (let p = Math.max(1, page - window); p <= Math.min(pageCount, page + window); p++) {
    numbers.push(p);
  }

  return (
    <nav className="flex items-center justify-center gap-2 pt-6">
      <PendingLink
        href={prevHref}
        ariaDisabled={page === 1}
        className={`px-3 h-9 inline-flex items-center font-mono text-[11px] uppercase tracked-wide border border-border-subtle ${
          page === 1
            ? "pointer-events-none opacity-40"
            : "hover:border-accent hover:text-accent"
        } transition-colors`}
      >
        ←
      </PendingLink>
      {numbers[0] > 1 && (
        <>
          <PendingLink
            href={buildPageHref(currentParams, 1)}
            className="px-3 h-9 inline-flex items-center font-mono text-[11px] border border-border-subtle hover:border-accent hover:text-accent transition-colors"
          >
            1
          </PendingLink>
          {numbers[0] > 2 && (
            <span className="font-mono text-text-secondary">…</span>
          )}
        </>
      )}
      {numbers.map((p) => (
        <PendingLink
          key={p}
          href={buildPageHref(currentParams, p)}
          ariaCurrent={p === page ? "page" : undefined}
          className={`px-3 h-9 inline-flex items-center font-mono text-[11px] border transition-colors ${
            p === page
              ? "border-accent text-accent"
              : "border-border-subtle hover:border-accent hover:text-accent"
          }`}
        >
          {p}
        </PendingLink>
      ))}
      {numbers[numbers.length - 1] < pageCount && (
        <>
          {numbers[numbers.length - 1] < pageCount - 1 && (
            <span className="font-mono text-text-secondary">…</span>
          )}
          <PendingLink
            href={buildPageHref(currentParams, pageCount)}
            className="px-3 h-9 inline-flex items-center font-mono text-[11px] border border-border-subtle hover:border-accent hover:text-accent transition-colors"
          >
            {pageCount}
          </PendingLink>
        </>
      )}
      <PendingLink
        href={nextHref}
        ariaDisabled={page === pageCount}
        className={`px-3 h-9 inline-flex items-center font-mono text-[11px] uppercase tracked-wide border border-border-subtle ${
          page === pageCount
            ? "pointer-events-none opacity-40"
            : "hover:border-accent hover:text-accent"
        } transition-colors`}
      >
        →
      </PendingLink>
    </nav>
  );
}
