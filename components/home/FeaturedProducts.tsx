import { ProductCard } from "@/components/catalog/ProductCard";
import { getRecentlyAddedProducts } from "@/lib/queries";

// "Recién agregadas" — pure newest-first feed of available stock so
// returning visitors can immediately see what's new since their last
// visit. Featured / curated highlights live in the Hero block above.
export async function FeaturedProducts() {
  const cards = await getRecentlyAddedProducts(4);
  if (cards.length === 0) return null;

  return (
    <section id="catalogo" className="border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <header className="flex items-end justify-between mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
              Novedades
            </span>
            <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
              Recién agregadas
            </h2>
          </div>
          <a
            href="/catalogo?orden=reciente"
            className="font-body text-sm text-text-secondary hover:text-accent transition-colors"
          >
            Ver todo →
          </a>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <ProductCard key={c.id} card={c} priority={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
