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
  "lg:translate-y-2 lg:rotate-[-3deg] lg:scale-[1.1] lg:z-10 delay-1",
  "lg:translate-y-20 lg:-translate-x-6 lg:rotate-[2deg] lg:scale-[1.18] lg:z-20 delay-2",
  "lg:translate-y-0 lg:-translate-x-12 lg:rotate-[-1deg] lg:scale-[1.1] lg:z-10 delay-3",
];

function PreviewCard({ p, idx }: { p: HomeProductCard; idx: number }) {
  // Above-the-fold hero -- first preview is the page's LCP candidate, so
  // it eager-loads with fetchpriority="high". The other two stay lazy to
  // keep bytes off the critical path.
  const isLcp = idx === 0;
  return (
    <Link
      href={`/products/${p.slug}`}
      className={`group relative bg-bg-surface border border-border-subtle rounded-sm overflow-hidden anim-fade-up transition-transform duration-300 hover:!z-30 hover:!translate-y-0 hover:!rotate-0 ${stagger[idx]}`}
    >
      <span className="top-accent" aria-hidden />
      <div className={`relative aspect-[3/4] overflow-hidden ${caseClassMap[p.caseGradient]} silhouette-figure`}>
        {p.imageUrl && (
          <Image
            src={p.imageUrl}
            alt={p.name}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 25vw, 33vw"
            className="object-cover product-img-zoom"
            priority={isLcp}
            loading={isLcp ? "eager" : "lazy"}
          />
        )}
      </div>
      <div className="p-3 lg:p-4 flex flex-col gap-1">
        <span className="font-mono text-[9px] lg:text-[10px] uppercase tracked-wide text-text-secondary">
          {p.lineName}
        </span>
        <span className="font-body text-xs lg:text-sm font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
          {p.name}
        </span>
        <span className="font-display text-base lg:text-lg tracked-mid text-text-primary">
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

export async function Hero({
  availableCount,
  curatedCount,
}: {
  availableCount: number;
  curatedCount: number;
}) {
  const previews = await getHeroPreviewProducts(3);
  const slots = Array.from({ length: 3 }, (_, i) => previews[i] ?? null);
  // Round down to the nearest 10 so the headline stays a stable "200+" /
  // "300+" claim instead of jittering every time a sale flips a product
  // to status='sold'. Avoids the previous hardcoded literal going stale.
  const inventoryClaim = Math.max(0, Math.floor(curatedCount / 10) * 10);

  return (
    <section className="relative overflow-hidden noise-bg hero-glow diag-lines border-b border-border-subtle">
      <div className="max-w-7xl xl:max-w-[1500px] mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-[5fr_7fr] gap-8 lg:gap-4 xl:gap-8 items-center">
        <div className="flex flex-col gap-8 anim-fade-up lg:max-w-xl">
          <p className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            <span className="text-text-primary">+{inventoryClaim}</span>{" "}
            figuras curadas
            <span aria-hidden className="text-border-medium px-2">
              ·
            </span>
            <span className="text-text-primary">{availableCount}</span>{" "}
            disponibles ahora
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[0.95] tracked-mid text-text-primary">
            CADA COLECCIÓN TIENE SU HISTORIA.
            <br />
            LA <span className="text-accent">TUYA</span> EMPIEZA ACÁ.
          </h1>
          <p className="max-w-md font-body text-base text-text-secondary leading-relaxed">
            Fotos reales, atención personalizada, stock curado. Encontrá la
            pieza que faltaba.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/catalogo"
              className="cta-primary font-mono uppercase tracked-wide text-sm px-6 py-3 text-text-primary inline-flex items-center"
            >
              Ver catálogo
            </Link>
            <a
              href="#how"
              className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cómo funciona →
            </a>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-4 lg:gap-0 lg:pl-0 lg:pr-8">
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
