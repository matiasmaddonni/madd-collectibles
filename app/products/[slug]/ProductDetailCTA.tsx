"use client";

import { useCart, type CartItem } from "@/components/cart/CartProvider";
import { trackEvent, trackMetaEvent } from "@/lib/analytics";

type Props = {
  item: Omit<CartItem, "qty">;
  slug: string;
  disabled?: boolean;
};

export function ProductDetailCTA({ item, slug, disabled }: Props) {
  const { add, has, open } = useCart();
  const inCart = has(item.id);

  const onClick = () => {
    if (disabled) return;
    // Fire conversion-intent analytics first; never block the cart action.
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
    if (inCart) {
      open();
      return;
    }
    add(item);
  };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full h-12 rounded-sm bg-bg-elevated border border-border-subtle font-mono uppercase tracked-wide text-sm text-text-secondary cursor-not-allowed"
      >
        No disponible
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="cta-primary w-full inline-flex items-center justify-center gap-2 px-6 h-12 rounded-sm font-mono uppercase tracked-wide text-sm text-text-primary"
    >
      {inCart ? "Ver carrito" : "Agregar al carrito"}
    </button>
  );
}
