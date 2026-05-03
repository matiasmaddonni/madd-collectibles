import { formatArs, type Product, type ProductStatus } from "@/lib/sample-products";

const statusDotClass: Record<ProductStatus, string> = {
  Disponible: "bg-green-500 dot-pulse",
  Reservado: "bg-amber-500",
  Vendido: "bg-zinc-500",
};

const statusTextClass: Record<ProductStatus, string> = {
  Disponible: "text-green-400",
  Reservado: "text-amber-400",
  Vendido: "text-zinc-500",
};

const caseClassMap = {
  gold: "case-gradient-gold",
  crimson: "case-gradient-crimson",
  mixed: "case-gradient-mixed",
  cool: "case-gradient-cool",
} as const;

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group relative bg-bg-surface border border-border-subtle rounded-sm overflow-hidden flex flex-col">
      <span className="top-accent" aria-hidden />

      <div className="relative aspect-square overflow-hidden">
        <div
          className={`absolute inset-0 product-img-zoom ${caseClassMap[product.caseGradient]} silhouette-figure`}
        />

        <span className="absolute top-3 left-3 z-10 font-mono text-[10px] tracked-wide uppercase px-2 py-1 bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-secondary">
          {product.line}
        </span>
        <span className="absolute top-3 right-3 z-10 font-mono text-[10px] tracked-wide uppercase px-2 py-1 bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-secondary">
          {product.condition}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="font-body font-semibold text-text-primary leading-snug">
          {product.name}
        </h3>
        <p className="font-body text-sm text-text-secondary">{product.series}</p>

        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="font-display text-2xl tracked-mid text-text-primary">
            {formatArs(product.priceArs)}
          </span>
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracked-wide">
            <span
              aria-hidden
              className={`inline-block w-2 h-2 rounded-full ${statusDotClass[product.status]}`}
            />
            <span className={statusTextClass[product.status]}>
              {product.status}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
