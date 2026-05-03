type Category = {
  slug: string;
  name: string;
  count: number;
  gradient: "gold" | "crimson" | "mixed" | "cool";
};

const caseClassMap = {
  gold: "case-gradient-gold",
  crimson: "case-gradient-crimson",
  mixed: "case-gradient-mixed",
  cool: "case-gradient-cool",
} as const;

const categories: Category[] = [
  { slug: "myth-cloth", name: "Myth Cloth", count: 42, gradient: "gold" },
  { slug: "myth-cloth-ex", name: "Myth Cloth EX", count: 68, gradient: "crimson" },
  {
    slug: "shf-dragon-ball",
    name: "S.H.Figuarts Dragon Ball",
    count: 31,
    gradient: "mixed",
  },
  { slug: "shf-otros", name: "S.H.Figuarts Otros", count: 24, gradient: "cool" },
];

export function CategoryGrid() {
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
            <a
              key={c.slug}
              href={`#${c.slug}`}
              className={`group relative aspect-[4/3] noise-bg border border-border-subtle rounded-sm overflow-hidden ${caseClassMap[c.gradient]}`}
            >
              <span className="top-accent" aria-hidden />
              <div className="absolute inset-0 silhouette-figure" />
              <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
                <span className="font-mono text-[10px] uppercase tracked-wide text-text-secondary">
                  {c.count} piezas
                </span>
                <h3 className="font-display text-3xl md:text-4xl tracked-mid text-text-primary mt-1">
                  {c.name}
                </h3>
                <span className="mt-3 font-body text-sm text-text-secondary group-hover:text-accent transition-colors">
                  Ver línea →
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
