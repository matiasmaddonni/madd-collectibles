import Image from "next/image";
import { waLink } from "@/lib/contact";
import { SOCIAL_FOLLOWERS } from "@/lib/social";

function WhatsAppIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62A12 12 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52ZM12 22a9.94 9.94 0 0 1-5.07-1.39l-.36-.21-3.67.96.98-3.58-.23-.37A9.94 9.94 0 0 1 2 12c0-5.52 4.48-10 10-10 2.67 0 5.18 1.04 7.07 2.93A9.93 9.93 0 0 1 22 12c0 5.52-4.48 10-10 10Zm5.45-7.45c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.65-.93-2.25-.25-.6-.5-.52-.68-.52h-.58c-.2 0-.53.07-.8.38-.27.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function MailIcon({ size = 16 }: { size?: number }) {
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
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function CameraIcon({ size = 22 }: { size?: number }) {
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
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PackageIcon({ size = 22 }: { size?: number }) {
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
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8 12 13 3 8" />
      <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
      <path d="M12 22V13" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 22 }: { size?: number }) {
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
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function MapPinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden
    >
      <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    </svg>
  );
}

const WORK_CARDS = [
  {
    Icon: CameraIcon,
    title: "Las fotos son reales",
    body:
      "Antes de cerrar cualquier venta te mando fotos reales de la figura. Lo que ves es lo que recibís.",
  },
  {
    Icon: PackageIcon,
    title: "Coordino el envío con vos",
    body:
      "Trabajo con Andreani. El costo lo calculamos juntos según tu ubicación.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Pago acordado",
    body:
      "Acepto Mercado Pago / Transferencia Bancaria / Efectivo (Pesos o Dolares). Confirmamos todo por WhatsApp antes de proceder.",
  },
];

export function AboutMadd() {
  return (
    <section
      id="sobre-mi"
      className="border-b border-border-subtle"
      aria-labelledby="sobre-mi-title"
    >
      {/* PAGE HEADER */}
      <div className="max-w-7xl mx-auto px-6 pt-20 md:pt-28">
        <header className="flex flex-col gap-2 mb-2">
          <span
            id="sobre-mi-title"
            className="font-mono text-xs uppercase tracked-wide text-text-secondary"
          >
            De coleccionista a coleccionista
          </span>
          <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
            Sobre MADD<span className="text-accent">.</span>
          </h2>
        </header>
      </div>

      {/* PROFILE */}
      <div className="max-w-7xl mx-auto px-6 py-14 md:py-20 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-4 flex flex-col items-center md:items-start gap-6">
          <div
            className="w-full max-w-[420px] aspect-square rounded-full bg-bg-elevated border-2 border-accent overflow-hidden silhouette-figure"
            aria-hidden>
            <Image
              src={"/profile.jpg"}
              loading="eager"
              alt="Foto de Matias Maddonni"
              width={420}
              height={420}
              className="w-full max-w-[420px] aspect-square rounded-full bg-bg-elevated border-2 border-accent object-cover silhouette-figure"
            />
          </div>

          <div className="flex flex-col items-center md:items-start gap-1">
            <h3 className="font-display text-3xl tracked-mid text-text-primary leading-none">
              Matias Maddonni
            </h3>
            <span className="font-mono text-sm text-accent">
              @madd.collector
            </span>
            <span className="font-mono text-[11px] text-text-secondary mt-1">
              {SOCIAL_FOLLOWERS.instagram} en Instagram ·{" "}
              {SOCIAL_FOLLOWERS.tiktok} en TikTok
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href={waLink()}
              className="cta-primary inline-flex items-center justify-center gap-2 px-5 h-11 rounded-md font-body text-sm font-medium text-text-primary"
            >
              <WhatsAppIcon size={16} color="#FFFFFF" />
              Escribime
            </a>
            <a
              href="mailto:hello@madd.shop"
              className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-md border border-border-subtle hover:border-accent transition-colors font-body text-sm text-text-primary"
            >
              <MailIcon size={16} />
              hello@madd.shop
            </a>
          </div>
        </div>

        <div className="md:col-span-8 flex flex-col gap-6">
          <span className="font-mono text-[11px] uppercase tracked-wide text-text-secondary border-l-2 border-accent pl-3">
            Quién soy
          </span>
          <h3 className="font-display text-3xl md:text-4xl tracked-mid text-text-primary leading-[1.05]">
            Coleccionista desde 2020. Fanático nostalgico de los animes de los 90s.
          </h3>
          <p className="font-body text-[15px] leading-[1.7] text-text-secondary">
            Soy Matias, coleccionista apasionado desde hace más de 6 años. 
            Empecé con las Myth Cloth EX (en particular la de Kanon de Geminis)
            y no paré más. Hoy tengo un stock cuidado de más de 300 piezas
            entre Myth Cloth EX, S.H.Figuarts y más. Cada figura que vendí pasó
            por mis manos, la guardé como si fuera mía, y la entrego con la
            misma atención.
          </p>
        </div>
      </div>

      {/* HOW I WORK */}
      <div className="bg-bg-surface border-y border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <header className="flex flex-col gap-2 mb-10">
            <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
              Cada paso, claro
            </span>
            <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
              Cómo trabajo
            </h2>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {WORK_CARDS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="group relative p-7 rounded-md bg-bg-deep border border-border-subtle transition-transform duration-200 hover:-translate-y-1"
              >
                <span className="top-accent" aria-hidden />
                <div className="w-11 h-11 grid place-items-center rounded-md bg-bg-elevated border border-border-medium text-text-primary mb-6">
                  <Icon size={22} />
                </div>
                <h4 className="font-display text-2xl tracked-mid mb-3 leading-none text-text-primary">
                  {title}
                </h4>
                <p className="font-body text-sm max-w-[34ch] text-text-secondary">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LOCATION */}
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
        <header className="flex flex-col gap-2 mb-10">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            Operando desde Argentina
          </span>
          <h2 className="font-display text-4xl md:text-5xl tracked-mid text-text-primary">
            Dónde estoy
          </h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-10 items-center">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="font-display text-5xl md:text-6xl tracked-mid text-text-primary leading-none">
                Tandil
              </span>
              <span className="font-body text-base text-text-secondary mt-2">
                Buenos Aires, Argentina
              </span>
            </div>
            <p className="font-body text-text-secondary leading-relaxed max-w-md">
              Hago envíos a todo el país. Para entregas en mano coordinamos por
              WhatsApp.
            </p>
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracked-wide text-text-secondary">
              <span
                aria-hidden
                className="inline-block w-2 h-2 rounded-full bg-green-500 dot-pulse"
              />
              <span className="text-green-400">Envíos a todo el país por Andreani</span>
            </span>
          </div>

          <div className="relative aspect-[4/5] md:aspect-[5/4] bg-bg-surface border border-border-subtle rounded-sm overflow-hidden">
            <Image
              src="/map_background.png"
              alt=""
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-cover opacity-90"
              priority={false}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-tr from-bg-deep/40 via-transparent to-bg-deep/20"
            />

            {/* Tandil pin: ~62% from left, ~65% from top */}
            <div
              className="absolute"
              style={{ left: "61%", top: "72%", transform: "translate(-50%, -50%)" }}
            >
              <span
                aria-hidden
                className="absolute inset-0 -m-3 rounded-full bg-accent/40 animate-ping"
              />
              <span className="relative inline-flex items-center justify-center text-accent">
                <MapPinIcon size={22} />
              </span>
              <span className="absolute left-7 top-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracked-wide text-text-primary whitespace-nowrap">
                Tandil
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
