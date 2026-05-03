import { heroPreviewProducts, formatArs } from "@/lib/sample-products";

const caseClassMap = {
  gold: "case-gradient-gold",
  crimson: "case-gradient-crimson",
  mixed: "case-gradient-mixed",
  cool: "case-gradient-cool",
} as const;

const stagger = [
  "lg:translate-y-0 lg:rotate-[-2deg] delay-1",
  "lg:translate-y-12 lg:rotate-[1.5deg] delay-2",
  "lg:translate-y-4 lg:-translate-x-6 lg:rotate-[-0.5deg] delay-3",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden noise-bg hero-glow diag-lines border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-8 anim-fade-up">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            Coleccionista a coleccionista
          </span>
          <h1 className="font-display text-6xl md:text-8xl lg:text-[8rem] leading-[0.9] tracked-mid text-text-primary">
            Piezas seleccionadas.
            <br />
            <span className="text-accent">Historia</span> en cada caja.
          </h1>
          <p className="max-w-md font-body text-base text-text-secondary leading-relaxed">
            Curaduría obsesiva de Myth Cloth, Myth Cloth EX y S.H.Figuarts. Cada
            pieza, verificada y fotografiada por nosotros.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#catalogo"
              className="cta-primary font-mono uppercase tracked-wide text-sm px-6 py-3 text-text-primary inline-flex items-center"
            >
              Ver catálogo
            </a>
            <a
              href="#como-funciona"
              className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cómo funciona →
            </a>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-4 lg:gap-6 lg:pl-12">
          {heroPreviewProducts.map((p, i) => (
            <div
              key={p.id}
              className={`group relative bg-bg-surface border border-border-subtle rounded-sm overflow-hidden anim-fade-up ${stagger[i]}`}
            >
              <span className="top-accent" aria-hidden />
              <div
                className={`aspect-[3/4] ${caseClassMap[p.caseGradient]} silhouette-figure`}
              />
              <div className="p-3 flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracked-wide text-text-secondary">
                  {p.line}
                </span>
                <span className="font-body text-xs font-semibold text-text-primary truncate">
                  {p.name}
                </span>
                <span className="font-display text-base tracked-mid text-text-primary">
                  {formatArs(p.priceArs)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
