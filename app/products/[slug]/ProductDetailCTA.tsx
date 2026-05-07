"use client";

import { useCart, type CartItem } from "@/components/cart/CartProvider";
import { trackEvent, trackMetaEvent } from "@/lib/analytics";
import { waLink } from "@/lib/contact";
import { formatPrice } from "@/lib/format";

function WhatsAppIcon({ size = 18, color = "#25D366" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62A12 12 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52ZM12 22a9.94 9.94 0 0 1-5.07-1.39l-.36-.21-3.67.96.98-3.58-.23-.37A9.94 9.94 0 0 1 2 12c0-5.52 4.48-10 10-10 2.67 0 5.18 1.04 7.07 2.93A9.93 9.93 0 0 1 22 12c0 5.52-4.48 10-10 10Zm5.45-7.45c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.65-.93-2.25-.25-.6-.5-.52-.68-.52h-.58c-.2 0-.53.07-.8.38-.27.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

type Props = {
  item: Omit<CartItem, "qty">;
  slug: string;
  disabled?: boolean;
};

export function ProductDetailCTA({ item, slug, disabled }: Props) {
  const { add, has, open } = useCart();
  const inCart = has(item.id);

  // Primary: WhatsApp consultation.
  // The product page IS the buy button — single tap to a prefilled message.
  const onWhatsApp = () => {
    if (disabled) return;
    trackEvent("whatsapp_click_product", {
      slug,
      productName: item.name,
      price: item.price,
      currency: item.currency,
      line: item.lineName,
    });
    trackMetaEvent("Lead", {
      content_ids: [slug],
      content_type: "product",
      value: item.price,
      currency: item.currency,
    });
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://madd-collectibles.vercel.app";
    const url = `${siteUrl}/products/${slug}`;
    const msg = `Hola Matias, me interesa "${item.name}" (${formatPrice(
      item.price,
      item.currency,
    )}). ¿Sigue disponible?\n${url}`;
    window.open(waLink(msg), "_blank");
  };

  // Secondary: add to cart / view cart.
  const onCart = () => {
    if (disabled) return;
    if (inCart) {
      open();
      return;
    }
    add({ ...item, slug });
  };

  if (disabled) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled
          className="w-full h-12 rounded-sm bg-bg-elevated border border-border-subtle font-mono uppercase tracked-wide text-sm text-text-secondary cursor-not-allowed"
        >
          No disponible
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onWhatsApp}
        className="cta-primary w-full inline-flex items-center justify-center gap-2 px-6 h-12 rounded-sm font-mono uppercase tracked-wide text-sm text-text-primary"
      >
        <WhatsAppIcon size={16} />
        Consultar por WhatsApp
      </button>
      <button
        type="button"
        onClick={onCart}
        className="w-full inline-flex items-center justify-center gap-2 px-6 h-11 rounded-sm font-mono uppercase tracked-wide text-xs border border-border-subtle text-text-primary hover:border-accent hover:text-accent transition-colors"
      >
        {inCart ? "Ver carrito" : "Agregar al carrito"}
      </button>
    </div>
  );
}
