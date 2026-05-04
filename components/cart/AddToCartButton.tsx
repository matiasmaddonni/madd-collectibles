"use client";

import { useCart, type CartItem } from "./CartProvider";

type Props = {
  item: Omit<CartItem, "qty">;
  disabled?: boolean;
};

function BagPlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
      <path d="M12 14v6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function AddToCartButton({ item, disabled }: Props) {
  const { add, has, open } = useCart();
  const inCart = has(item.id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (inCart) {
      open();
      return;
    }
    add(item);
  };

  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={inCart ? "Ver carrito" : "Agregar al carrito"}
      className={`absolute bottom-3 right-3 z-30 grid place-items-center w-10 h-10 rounded-sm border backdrop-blur-sm transition-all duration-200
        ${
          inCart
            ? "bg-accent border-accent text-text-primary opacity-100"
            : "bg-bg-deep/80 border-border-subtle text-text-primary opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-accent hover:border-accent"
        }`}
    >
      {inCart ? <CheckIcon /> : <BagPlusIcon />}
    </button>
  );
}
