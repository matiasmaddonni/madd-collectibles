"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
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

const LINKS: { label: string; href: string }[] = [
  { label: "Inicio", href: "/" },
  { label: "Catálogo", href: "/catalogo" },
  { label: "Cómo comprar", href: "/#how" },
  { label: "Sobre mí", href: "/#sobre-mi" },
];

// Mobile-only hamburger + drawer. Hidden ≥1024px where the inline nav appears.
//
// The drawer is portaled to document.body because Navbar's <header> uses
// `backdrop-blur`, which creates a new containing block for `position: fixed`
// descendants per CSS spec. Without the portal, `fixed inset-0 / h-full`
// resolves against the navbar (≈ 64 px) instead of the viewport, hiding the
// link list below the header.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Only portal once we're on the client; SSR has no document.body.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on route change (e.g. after clicking a link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const drawer = (
    <div className="lg:hidden">
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Menú principal"
        className={`fixed top-0 right-0 z-[70] h-dvh w-full sm:max-w-sm bg-bg-surface border-l border-border-subtle flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
          <span className="font-display text-2xl tracked-mid text-text-primary">
            MADD<span className="text-accent">.</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <CloseIcon />
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li
                key={l.href}
                className="border-b border-border-subtle/60 last:border-b-0"
              >
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-6 py-5 font-display text-2xl tracked-mid text-text-primary hover:bg-bg-elevated hover:text-accent transition-colors"
                >
                  {l.label}
                  <span aria-hidden className="text-text-secondary">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 text-text-primary hover:text-accent transition-colors"
      >
        <MenuIcon />
      </button>

      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
