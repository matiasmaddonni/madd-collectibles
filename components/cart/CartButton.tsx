"use client";

import { useCart } from "./CartProvider";
import { trackEvent } from "@/lib/analytics";

function BagIcon() {
  return (
    <svg
      width="20"
      height="20"
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
    </svg>
  );
}

export function CartButton() {
  const { count, isOpen, toggle } = useCart();
  const onClick = () => {
    // Fire on opens only — closing the drawer isn't an engagement signal.
    if (!isOpen) trackEvent("cart_open", { itemCount: count });
    toggle();
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Carrito"
      className="relative p-2 text-text-primary hover:text-accent transition-colors"
    >
      <BagIcon />
      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-[10px] font-mono leading-4 text-text-primary text-center">
        {count}
      </span>
    </button>
  );
}
