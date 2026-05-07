import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { HomeProductCard } from "@/lib/queries";
import type { ProductStatus } from "@/lib/supabase/types";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { CardImageCarousel } from "@/components/catalog/CardImageCarousel";

const statusDotClass: Record<ProductStatus, string> = {
  available: "bg-green-500 dot-pulse",
  reserved: "bg-amber-500",
  sold: "bg-zinc-500",
};

const statusTextClass: Record<ProductStatus, string> = {
  available: "text-green-400",
  reserved: "text-amber-400",
  sold: "text-zinc-500",
};

const caseClassMap = {
  gold: "case-gradient-gold",
  crimson: "case-gradient-crimson",
  mixed: "case-gradient-mixed",
  cool: "case-gradient-cool",
} as const;

export function ProductCard({
  card,
  priority = false,
}: {
  card: HomeProductCard;
  // Set on the first card of an above-the-fold grid so its image is eagerly
  // loaded — fixes Next.js LCP warning on home / product detail.
  priority?: boolean;
}) {
  const href = `/products/${card.slug}`;
  return (
    <article className="group relative bg-bg-surface border border-border-subtle rounded-sm overflow-hidden flex flex-col">
      <span className="top-accent" aria-hidden />

      {/*
        Single tap target for navigation: a stretched link covering the entire
        card sits at z-[1]. Carousel arrows / dots / AddToCart button are
        siblings positioned absolutely above the link via higher z-index, and
        each calls e.stopPropagation() so they remain interactive without
        triggering navigation.
      */}
      <Link
        href={href}
        aria-label={card.name}
        className="absolute inset-0 z-[1]"
      />

      <div className="relative aspect-square overflow-hidden">
        <div
          className={`absolute inset-0 ${caseClassMap[card.caseGradient]} silhouette-figure`}
        />
        {card.images.length > 1 ? (
          <CardImageCarousel
            images={card.images}
            alt={card.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
          />
        ) : (
          card.imageUrl && (
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover product-img-zoom"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
            />
          )
        )}

        <span className="absolute top-3 left-3 z-10 pointer-events-none font-mono text-[10px] tracked-wide uppercase px-2 py-1 bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-secondary">
          {card.lineName}
        </span>
        <span className="absolute top-3 right-3 z-10 pointer-events-none font-mono text-[10px] tracked-wide uppercase px-2 py-1 bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-secondary">
          {card.conditionLabel}
        </span>

        <AddToCartButton
          disabled={card.status !== "available"}
          item={{
            id: card.id,
            slug: card.slug,
            name: card.name,
            lineName: card.lineName,
            price: card.price,
            currency: card.currency,
            imageUrl: card.imageUrl,
          }}
        />
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1 group-hover:text-accent transition-colors">
        <h3 className="font-body font-semibold text-text-primary leading-snug group-hover:text-accent transition-colors">
          {card.name}
        </h3>
        <p className="font-body text-sm text-text-secondary">
          {card.seriesName ?? card.lineName}
        </p>

        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="font-display text-2xl tracked-mid text-text-primary">
            {formatPrice(card.price, card.currency)}
          </span>
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracked-wide">
            <span
              aria-hidden
              className={`inline-block w-2 h-2 rounded-full ${statusDotClass[card.status]}`}
            />
            <span className={statusTextClass[card.status]}>
              {card.statusLabel}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
