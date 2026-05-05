import Image from "next/image";
import Link from "next/link";
import { getHeroPreviewProducts, type HomeProductCard } from "@/lib/queries";
import { formatPrice } from "@/lib/format";

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

function PreviewCard({ p, idx }: { p: HomeProductCard; idx: number }) {
  return (
    <Link
      href={`/products/${p.slug}`}
      className={`group relative bg-bg-surface border border-border-subtle rounded-sm overflow-hidden anim-fade-up ${stagger[idx]}`}
    >
      <span className="top-accent" aria-hidden />
      <div className={`relative aspect-[3/4] overflow-hidden ${caseClassMap[p.caseGradient]} silhouette-figure`}>
        {p.imageUrl && (
          <Image
            src={p.imageUrl}
            alt={p.name}
            fill
            sizes="(min-width: 1024px) 16vw, 33vw"
            className="object-cover product-img-zoom"
          />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracked-wide text-text-secondary">
          {p.lineName}
        </span>
        <span className="font-body text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
          {p.name}
        </span>
        <span className="font-display text-base tracked-mid text-text-primary">
          {formatPrice(p.price, p.currency)}
        </span>
      </div>
    </Link>
  );
}

function PlaceholderCard({ idx }: { idx: number }) {
  return (
    <div
      className={`relative bg-bg-surface border border-border-subtle rounded-sm overflow-hidden anim-fade-up ${stagger[idx]}`}
    >
      <div className="aspect-[3/4] case-gradient-cool silhouette-figure" />
      <div className="p-3 h-[60px]" />
    </div>
  );
}

export async function Hero() {
  const previews = await getHeroPreviewProducts(3);
  const slots = Array.from({ length: 3 }, (_, i) => previews[i] ?? null);

  return (
    <section className="relative overflow-hidden noise-bg hero-glow diag-lines border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-8 anim-fade-up">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            Coleccionista a coleccionista
          </span>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[0.95] tracked-mid text-text-primary">
            CADA COLECCIÓN TIENE SU HISTORIA.
            <br />
            LA <span className="text-accent">TUYA</span> EMPIEZA ACÁ.
          </h1>
          <p className="max-w-md font-body text-base text-text-secondary leading-relaxed">
            Fotos reales, atención personalizada y el conocimiento de quien las coleccionó, 
            para que encuentres exactamente lo que buscás, o descubras lo que todavía no sabías que querías.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#catalogo"
              className="cta-primary font-mono uppercase tracked-wide text-sm px-6 py-3 text-text-primary inline-flex items-center"
            >
              Ver catálogo
            </a>
            <a
              href="#how"
              className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cómo funciona →
            </a>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-4 lg:gap-6 lg:pl-12">
          {slots.map((p, i) =>
            p ? (
              <PreviewCard key={p.id} p={p} idx={i} />
            ) : (
              <PlaceholderCard key={`ph-${i}`} idx={i} />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
