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
              placeholder="Buscá piezas, líneas, series…"
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

        <button
          type="button"
          aria-label="Carrito"
          className="relative p-2 text-text-primary hover:text-accent transition-colors"
        >
          <BagIcon />
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-[10px] font-mono leading-4 text-text-primary text-center">
            0
          </span>
        </button>
      </div>
    </header>
  );
}
