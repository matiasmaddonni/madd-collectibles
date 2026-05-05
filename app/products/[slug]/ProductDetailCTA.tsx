"use client";

import { useCart, type CartItem } from "@/components/cart/CartProvider";

type Props = {
  item: Omit<CartItem, "qty">;
  disabled?: boolean;
};

export function ProductDetailCTA({ item, disabled }: Props) {
  const { add, has, open } = useCart();
  const inCart = has(item.id);

  const onClick = () => {
    if (disabled) return;
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
