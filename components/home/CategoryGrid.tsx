import Image from "next/image";
import Link from "next/link";
import { getHomeCategories } from "@/lib/queries";

const caseClassMap = {
  gold: "case-gradient-gold",
  crimson: "case-gradient-crimson",
  mixed: "case-gradient-mixed",
  cool: "case-gradient-cool",
} as const;

export async function CategoryGrid() {
  const categories = await getHomeCategories();

  return (
    <section className="border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <header className="flex items-end justify-between mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
              Líneas
            </span>
            <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
              Explorá por colección
            </h2>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className={`group relative aspect-[4/3] border border-border-subtle rounded-sm overflow-hidden ${caseClassMap[c.caseGradient]}`}
            >
              <span className="top-accent" aria-hidden />
              <div className="absolute inset-0 silhouette-figure" />

              {c.imageUrl && (
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover opacity-70 group-hover:opacity-90 transition-opacity product-img-zoom"
                />
              )}

              <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-bg-deep via-bg-deep/85 to-transparent" />

              <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
                <span className="font-mono text-[10px] uppercase tracked-wide text-text-secondary">
                  {c.productCount} figuras
                </span>
                <h3 className="font-display text-3xl md:text-4xl tracked-mid text-text-primary mt-1">
                  {c.name}
                </h3>
                <span className="mt-3 font-body text-sm text-text-secondary group-hover:text-accent transition-colors">
                  Ver línea →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
