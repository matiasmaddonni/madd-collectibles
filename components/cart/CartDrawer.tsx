"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/format";
import { waLink } from "@/lib/contact";
import { recordCheckoutIntent } from "@/app/checkout/actions";
import { trackEvent, trackMetaEvent } from "@/lib/analytics";

function CloseIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function CartDrawer() {
  const { items, isOpen, close, remove, clear } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  const totalsByCurrency = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.currency] = (acc[it.currency] ?? 0) + it.price * it.qty;
    return acc;
  }, {});

  const onCheckout = () => {
    const lines = items
      .map((i) => `• ${i.name} ×${i.qty} — ${formatPrice(i.price, i.currency)}`)
      .join("\n");
    const totals = Object.entries(totalsByCurrency)
      .map(([cur, amt]) => formatPrice(amt, cur as "ARS" | "USD"))
      .join(" + ");
    const msg = `Hola MADD! Quiero coordinar la compra de:\n\n${lines}\n\nTotal: ${totals}`;

    // Fire conversion analytics first; never block the WhatsApp redirect.
    const itemCount = items.reduce((n, it) => n + it.qty, 0);
    const totalUSD = Math.round((totalsByCurrency.USD ?? 0) * 100) / 100;
    const slugs = items.map((it) => it.id);
    trackEvent("whatsapp_click_cart", { itemCount, totalUSD, slugs });
    trackMetaEvent("InitiateCheckout", {
      content_ids: slugs,
      content_type: "product",
      value: totalUSD,
      currency: "USD",
      num_items: itemCount,
    });

    void recordCheckoutIntent({
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        lineName: i.lineName,
        price: i.price,
        currency: i.currency,
        qty: i.qty,
      })),
      totals: totalsByCurrency,
    }).catch((e) => console.error("checkout intent failed", e));

    window.open(waLink(msg), "_blank");
  };

  return (
    <>
      <div
        aria-hidden
        onClick={close}
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Carrito"
        className={`fixed top-0 right-0 z-[70] h-full w-full sm:max-w-md bg-bg-surface border-l border-border-subtle flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracked-wide text-text-secondary">
              Tu carrito
            </span>
            <h2 className="font-display text-2xl tracked-mid text-text-primary">
              {items.length === 0
                ? "Vacío"
                : `${items.length} ${items.length === 1 ? "figura" : "figuras"}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar carrito"
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-body text-text-secondary">
                Todavía no agregaste niguna figura.
              </p>
              <p className="font-body text-sm text-text-secondary">
                Tocá el ícono de bolsa al pasar el mouse sobre una figura.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex gap-4 px-6 py-4 items-start"
                >
                  <div className="relative w-16 h-16 shrink-0 bg-bg-deep border border-border-subtle rounded-sm overflow-hidden">
                    {it.imageUrl && (
                      <Image
                        src={it.imageUrl}
                        alt={it.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracked-wide text-text-secondary truncate">
                      {it.lineName}
                    </p>
                    <p className="font-body text-sm font-semibold text-text-primary truncate">
                      {it.name}
                    </p>
                    <p className="font-display text-lg tracked-mid text-text-primary mt-1">
                      {formatPrice(it.price, it.currency)}
                      {it.qty > 1 && (
                        <span className="font-body text-xs text-text-secondary ml-2">
                          ×{it.qty}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    aria-label={`Quitar ${it.name}`}
                    className="p-2 text-text-secondary hover:text-accent transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-border-subtle px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracked-wide text-text-secondary">
                Total
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(totalsByCurrency).map(([cur, amt]) => (
                  <span
                    key={cur}
                    className="font-display text-2xl tracked-mid text-text-primary"
                  >
                    {formatPrice(amt, cur as "ARS" | "USD")}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCheckout}
                className="cta-primary flex-1 inline-flex items-center justify-center gap-2 px-5 h-12 rounded-sm font-mono uppercase tracked-wide text-sm text-text-primary"
              >
                Finalizar compra
              </button>
              <button
                type="button"
                onClick={clear}
                className="px-4 h-12 font-body text-sm text-text-secondary border border-border-subtle rounded-sm hover:text-text-primary transition-colors"
              >
                Vaciar
              </button>
            </div>
            <p className="font-body text-xs text-text-secondary">
              Te abrimos WhatsApp con el detalle. Coordinamos pago y envío por
              ahí.
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}
