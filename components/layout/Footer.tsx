function WhatsAppIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62A12 12 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52ZM12 22a9.94 9.94 0 0 1-5.07-1.39l-.36-.21-3.67.96.98-3.58-.23-.37A9.94 9.94 0 0 1 2 12c0-5.52 4.48-10 10-10 2.67 0 5.18 1.04 7.07 2.93A9.93 9.93 0 0 1 22 12c0 5.52-4.48 10-10 10Zm5.45-7.45c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.65-.93-2.25-.25-.6-.5-.52-.68-.52h-.58c-.2 0-.53.07-.8.38-.27.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function MailIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}

const NAV_LINKS = ["Inicio", "Myth Cloth", "S.H.Figuarts", "Sobre mí", "Cómo Comprar"];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-3 gap-10 items-start">
          <div>
            <span className="font-display text-2xl tracked-mid text-text-primary">
              MADD<span className="text-accent">.</span>
            </span>
            <p className="font-body text-sm mt-3 max-w-[28ch] text-text-secondary">
              De coleccionista a coleccionista.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-7 gap-y-3 md:justify-center">
            {NAV_LINKS.map((l) => (
              <a
                key={l}
                href="#"
                className="font-body text-[13px] text-text-secondary hover:text-accent transition-colors"
              >
                {l}
              </a>
            ))}
          </nav>

          <div className="flex md:justify-end items-center gap-3 flex-wrap">
            <a
              href="https://wa.me/"
              className="cta-primary inline-flex items-center gap-2 px-4 h-10 rounded-md font-body text-[13px] font-medium text-text-primary"
            >
              <WhatsAppIcon size={14} color="#25D366" />
              Escribime por WhatsApp
            </a>
            <a
              href="mailto:hello@madd.shop"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-md font-body text-[13px] text-text-secondary border border-border-subtle hover:text-text-primary transition-colors"
            >
              <MailIcon size={14} />
              hello@madd.shop
            </a>
          </div>
        </div>

        <div className="mt-12 pt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle">
          <p className="font-body text-xs text-text-secondary">
            © 2025 MADD. Todas las figuras son productos originales de Tamashii
            Nations.
          </p>
          <p className="font-body text-xs text-text-secondary">
            Hecho por un coleccionista. Vendido por un coleccionista.
          </p>
        </div>
      </div>
    </footer>
  );
}
