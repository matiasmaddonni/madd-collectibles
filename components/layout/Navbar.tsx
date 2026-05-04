import { CartButton } from "@/components/cart/CartButton";

function SearchIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

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

        <div className="hidden md:flex flex-1 max-w-xl mx-auto">
          <label className="flex items-center gap-2 w-full px-3 py-2 bg-bg-surface border border-border-subtle rounded-sm text-text-secondary focus-within:border-border-medium">
            <SearchIcon />
            <input
              type="search"
              placeholder="Buscá figuras, líneas, series…"
              aria-label="Buscar"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary"
            />
          </label>
        </div>

        <nav className="hidden lg:flex items-center gap-6 font-body text-sm text-text-secondary">
          <a href="#" className="hover:text-text-primary transition-colors">
            Catálogo
          </a>
          <a href="#" className="hover:text-text-primary transition-colors">
            Líneas
          </a>
          <a href="#" className="hover:text-text-primary transition-colors">
            Sobre MADD.
          </a>
        </nav>

        <CartButton />
      </div>
    </header>
  );
}
