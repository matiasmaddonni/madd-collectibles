import { waLink } from "@/lib/contact";

function SearchIcon({ size = 18 }: { size?: number }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BagPlusIcon({ size = 18 }: { size?: number }) {
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
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
      <path d="M12 14v6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62A12 12 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52ZM12 22a9.94 9.94 0 0 1-5.07-1.39l-.36-.21-3.67.96.98-3.58-.23-.37A9.94 9.94 0 0 1 2 12c0-5.52 4.48-10 10-10 2.67 0 5.18 1.04 7.07 2.93A9.93 9.93 0 0 1 22 12c0 5.52-4.48 10-10 10Zm5.45-7.45c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.65-.93-2.25-.25-.6-.5-.52-.68-.52h-.58c-.2 0-.53.07-.8.38-.27.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function CheckIcon({ size = 18 }: { size?: number }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Explorá y Elegí",
    body: "Encontrá lo que buscás, revisá condición y precio.",
    Icon: SearchIcon,
  },
  {
    n: "02",
    title: "Armá tu Lista",
    body: "Guardá tus elegidos. Los combos suelen convenir.",
    Icon: BagPlusIcon,
  },
  {
    n: "03",
    title: "Contactame por WhatsApp",
    body: "Mandame tu lista y coordinamos desde ahí.",
    Icon: WhatsAppIcon,
  },
];

export function HowToBuy() {
  return (
    <section id="how" className="bg-bg-surface border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <header className="flex flex-col gap-2 mb-10">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            Proceso
          </span>
          <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
            Cómo comprar
          </h2>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => {
            const Icon = s.Icon;
            return (
              <div
                key={s.n}
                className="group relative p-7 rounded-md bg-bg-deep border border-border-subtle"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="font-display text-[44px] leading-none tracked-mid text-accent opacity-85">
                    {s.n}
                  </span>
                  <div className="w-11 h-11 grid place-items-center rounded-md bg-bg-elevated border border-border-medium text-text-primary">
                    <Icon size={18} />
                  </div>
                </div>
                <h3 className="font-display text-2xl tracked-mid mb-3 leading-none text-text-primary">
                  {s.title}
                </h3>
                <p className="font-body text-sm max-w-[34ch] text-text-secondary">
                  {s.body}
                </p>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-border-medium" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 px-6 py-5 rounded-md bg-bg-deep border border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-green-500">
              <CheckIcon size={18} />
            </span>
            <p className="font-body text-sm text-text-primary">
              Todas las figuras son originales de Tamashii Nations. Fotos
              disponibles a pedido.
            </p>
          </div>
          <a
            href={waLink()}
            className="cta-primary inline-flex items-center gap-2 px-5 h-11 rounded-md font-body text-sm font-medium text-text-primary"
          >
            <WhatsAppIcon size={16} color="#25D366" />
            Escribime por WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
