import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CardImageCarousel } from "@/components/catalog/CardImageCarousel";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductDetailCTA } from "./ProductDetailCTA";
import { BackButton } from "./BackButton";
import { getProductBySlug, getRelatedProducts } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import {
  convertArsToUsd,
  convertUsdToArs,
  getUsdToArsRate,
} from "@/lib/currency";
import type { ProductStatus } from "@/lib/supabase/types";

const caseClassMap = {
  gold: "case-gradient-gold",
  crimson: "case-gradient-crimson",
  mixed: "case-gradient-mixed",
  cool: "case-gradient-cool",
} as const;

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

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado — MADD." };
  return {
    title: `${product.name} — MADD.`,
    description:
      product.description ??
      `${product.name} — ${product.lineName}. ${formatPrice(product.price, product.currency)}`,
    openGraph: product.imageUrl
      ? { images: [{ url: product.imageUrl }] }
      : undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const isAvailable = product.status === "available" && product.stockQty > 0;
  const [related, usdToArs] = await Promise.all([
    product.productLineSlug
      ? getRelatedProducts(product.productLineSlug, product.id, 4)
      : Promise.resolve([]),
    getUsdToArsRate(),
  ]);

  const altCurrency =
    product.currency === "USD"
      ? {
          amount: convertUsdToArs(product.price, usdToArs),
          currency: "ARS" as const,
        }
      : {
          amount: convertArsToUsd(product.price, usdToArs),
          currency: "USD" as const,
        };

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <article className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="mb-8">
            <BackButton />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
            <div className="md:col-span-3">
              <div
                className={`group relative aspect-[4/5] bg-bg-surface border border-border-subtle rounded-sm overflow-hidden ${caseClassMap[product.caseGradient]}`}
              >
                <span className="top-accent" aria-hidden />
                <div className="absolute inset-0 silhouette-figure" />

                {product.images.length > 0 ? (
                  <CardImageCarousel
                    images={product.images}
                    alt={product.name}
                    sizes="(min-width: 768px) 60vw, 100vw"
                  />
                ) : (
                  product.imageUrl && (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="(min-width: 768px) 60vw, 100vw"
                      className="object-cover product-img-zoom"
                      priority
                    />
                  )
                )}

                <span className="absolute top-4 left-4 z-10 pointer-events-none font-mono text-[10px] tracked-wide uppercase px-2 py-1 bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-secondary">
                  {product.conditionLabel}
                </span>
              </div>
            </div>

            <div className="md:col-span-2 md:sticky md:top-24 md:self-start flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-xs uppercase tracked-wide text-accent">
                  {product.lineName}
                </span>
                <h1 className="font-display text-5xl md:text-6xl tracked-mid text-text-primary leading-[0.95]">
                  {product.name}
                </h1>
                {product.seriesName && (
                  <p className="font-body text-sm text-text-secondary">
                    {product.seriesName}
                  </p>
                )}
              </div>

              <div className="flex items-end justify-between gap-4 border-t border-b border-border-subtle py-5">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-4xl tracked-mid text-text-primary">
                    {formatPrice(product.price, product.currency)}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracked-wide text-text-secondary">
                    ≈ {formatPrice(altCurrency.amount, altCurrency.currency)}
                  </span>
                </div>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracked-wide">
                  <span
                    aria-hidden
                    className={`inline-block w-2 h-2 rounded-full ${statusDotClass[product.status]}`}
                  />
                  <span className={statusTextClass[product.status]}>
                    {product.statusLabel}
                  </span>
                </span>
              </div>

              {product.description && (
                <p className="font-body text-text-secondary leading-relaxed">
                  {product.description}
                </p>
              )}

              <ProductDetailCTA
                disabled={!isAvailable}
                item={{
                  id: product.id,
                  name: product.name,
                  lineName: product.lineName,
                  price: product.price,
                  currency: product.currency,
                  imageUrl: product.imageUrl,
                }}
              />

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-border-subtle">
                <MetaRow label="Línea" value={product.lineName} />
                {product.seriesName && (
                  <MetaRow label="Serie" value={product.seriesName} />
                )}
                <MetaRow label="Condición" value={product.conditionLabel} />
                {product.releaseYear != null && (
                  <MetaRow label="Año" value={String(product.releaseYear)} />
                )}
                {product.sku && (
                  <MetaRow label="SKU" value={product.sku} mono />
                )}
              </dl>

              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {product.tags.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-[10px] uppercase tracked-wide px-2 py-1 border border-border-subtle text-text-secondary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="bg-bg-surface border-t border-border-subtle">
            <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
              <header className="flex flex-col gap-2 mb-10 pl-4 border-l-2 border-accent">
                <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
                  Más de la línea
                </span>
                <h2 className="font-display text-3xl md:text-4xl tracked-mid text-text-primary">
                  También te puede interesar
                </h2>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {related.map((c) => (
                  <ProductCard key={c.id} card={c} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracked-wide text-text-secondary">
        {label}
      </dt>
      <dd
        className={`text-sm text-text-primary ${mono ? "font-mono" : "font-body"}`}
      >
        {value}
      </dd>
    </div>
  );
}
