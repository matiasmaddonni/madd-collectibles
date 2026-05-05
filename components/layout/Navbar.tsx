import { Suspense } from "react";
import Link from "next/link";
import { CartButton } from "@/components/cart/CartButton";
import { NavbarSearch } from "@/components/layout/NavbarSearch";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-bg-deep/80 backdrop-blur border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
        <a
          href="/"
          className="font-display text-2xl tracked-mid text-text-primary"
        >
          MADD<span className="text-accent">.</span>
        </a>

        <Suspense fallback={<div className="hidden md:block flex-1 max-w-xl mx-auto h-10" />}>
          <NavbarSearch />
        </Suspense>

        <nav className="hidden lg:flex items-center gap-6 font-body text-sm text-text-secondary">
          <Link href="/catalogo" className="hover:text-text-primary transition-colors">
            Catálogo
          </Link>
          <a href="/#how" className="hover:text-text-primary transition-colors">
            Cómo comprar
          </a>
          <a href="/#sobre-mi" className="hover:text-text-primary transition-colors">
            Sobre mí
          </a>
        </nav>

        <CartButton />
      </div>
    </header>
  );
}
