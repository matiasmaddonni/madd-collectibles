import { Suspense } from "react";
import Link from "next/link";
import { CartButton } from "@/components/cart/CartButton";
import { NavbarSearch } from "@/components/layout/NavbarSearch";
import { MobileMenu } from "@/components/layout/MobileMenu";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-bg-deep/80 backdrop-blur border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center flex-wrap gap-4 md:flex-nowrap md:gap-6">
        <Link
          href="/"
          className="order-1 font-display text-2xl tracked-mid text-text-primary"
        >
          MADD<span className="text-accent">.</span>
        </Link>

        {/* Mobile: search wraps to its own row below the brand. Tablet+: stays inline. */}
        <Suspense fallback={<div className="order-3 w-full mt-3 h-10 md:order-2 md:mt-0 md:flex-1 md:max-w-xl md:mx-auto md:w-auto" />}>
          <NavbarSearch />
        </Suspense>

        <nav className="hidden lg:flex order-2 items-center gap-6 font-body text-sm text-text-secondary">
          <Link href="/catalogo" className="hover:text-text-primary transition-colors">
            Catálogo
          </Link>
          <Link href="/#how" className="hover:text-text-primary transition-colors">
            Cómo comprar
          </Link>
          <Link href="/#sobre-mi" className="hover:text-text-primary transition-colors">
            Sobre mí
          </Link>
        </nav>

        <div className="order-2 ml-auto md:ml-0 flex items-center gap-2">
          <CartButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
