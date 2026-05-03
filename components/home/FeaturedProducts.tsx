import { ProductCard } from "@/components/catalog/ProductCard";
import { featuredProducts } from "@/lib/sample-products";

export function FeaturedProducts() {
  return (
    <section id="catalogo" className="border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <header className="flex items-end justify-between mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
              Destacados
            </span>
            <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
              Recién agregadas
            </h2>
          </div>
          <a
            href="#"
            className="font-body text-sm text-text-secondary hover:text-accent transition-colors"
          >
            Ver todo →
          </a>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
