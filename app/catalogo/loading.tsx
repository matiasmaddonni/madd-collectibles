import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function CatalogLoading() {
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

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-10">
            <aside className="hidden md:flex flex-col gap-6">
              <SkeletonGroup rows={5} />
              <SkeletonGroup rows={4} />
              <SkeletonGroup rows={2} />
            </aside>

            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 bg-bg-surface animate-pulse rounded-sm" />
                <div className="h-9 w-44 bg-bg-surface animate-pulse rounded-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function SkeletonGroup({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-3 w-20 bg-bg-surface animate-pulse rounded-sm" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full bg-bg-surface animate-pulse rounded-sm"
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-sm overflow-hidden flex flex-col">
      <div className="aspect-square bg-bg-elevated animate-pulse" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-3/4 bg-bg-elevated animate-pulse rounded-sm" />
        <div className="h-3 w-1/2 bg-bg-elevated animate-pulse rounded-sm" />
        <div className="flex items-center justify-between pt-3">
          <div className="h-6 w-20 bg-bg-elevated animate-pulse rounded-sm" />
          <div className="h-3 w-16 bg-bg-elevated animate-pulse rounded-sm" />
        </div>
      </div>
    </div>
  );
}
