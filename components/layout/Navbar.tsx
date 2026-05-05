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

        <NavbarSearch />

        <nav className="hidden lg:flex items-center gap-6 font-body text-sm text-text-secondary">
          <Link href="/catalogo" className="hover:text-text-primary transition-colors">
            Catálogo
          </Link>
          <a href="/#categorias" className="hover:text-text-primary transition-colors">
            Líneas
          </a>
          <a href="/#how" className="hover:text-text-primary transition-colors">
            Sobre MADD.
          </a>
        </nav>

        <CartButton />
      </div>
    </header>
  );
}
