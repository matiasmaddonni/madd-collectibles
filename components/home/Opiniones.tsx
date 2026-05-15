import Image from "next/image";
import Link from "next/link";
import { OPINIONES, type Opinion, type OpinionMessage } from "@/lib/opiniones";

function DoubleCheck() {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 16 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-[var(--color-check)]"
    >
      <path d="m1 5.5 3 3 6-6" />
      <path d="m6 8.5 6-6" />
    </svg>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div
      aria-label={`Avatar de ${name}`}
      role="img"
      className="w-8 h-8 rounded-full grid place-items-center font-mono text-xs text-text-primary border border-[var(--color-bg-elevated)]"
      style={{
        background:
          "radial-gradient(circle at 30% 25%, #2a2a30 0%, #0e0e10 90%)",
      }}
    >
      {initial}
    </div>
  );
}

function MessageBubble({ msg, cardName }: { msg: OpinionMessage; cardName: string }) {
  const isMe = msg.from === "me";
  const align = isMe ? "items-end self-end" : "items-start self-start";
  const bg = isMe
    ? "bg-[var(--color-bubble-me)]"
    : "bg-[var(--color-bubble-them)]";
  // Reduce one corner to anchor the bubble like a chat-app tail (without
  // imitating any specific app's pointed tail shape).
  const corners = isMe
    ? "rounded-2xl rounded-tr-[4px]"
    : "rounded-2xl rounded-tl-[4px]";
  return (
    <div
      className={`flex flex-col ${align} max-w-[82%] ${bg} ${corners} px-3 py-2`}
    >
      {msg.text && (
        <p
          className="font-body text-[12.5px] leading-[1.35] text-[var(--color-bubble-ink)]"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {msg.text}
        </p>
      )}
      {msg.image && (
        <div
          role="img"
          aria-label={`Imagen recibida: ${msg.image}`}
          className="foto-stripe relative w-full aspect-[4/3] rounded-md overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] mt-1 grid place-items-center"
        >
          <span className="font-mono text-[10px] uppercase tracked-wide text-text-secondary">
            FOTO
          </span>
          <span className="sr-only">{cardName}</span>
        </div>
      )}
      <span className="mt-1 inline-flex items-center gap-1 font-mono text-[9.5px] text-[var(--color-bubble-ink-dim)]">
        {msg.time}
        {isMe && <DoubleCheck />}
      </span>
    </div>
  );
}

function OpinionCard({ op }: { op: Opinion }) {
  return (
    <article
      aria-label={`Opinión de ${op.name} sobre ${op.product.name}`}
      className="snap-start shrink-0 md:shrink w-[304px] md:w-auto bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-bg-elevated border-b border-border-subtle">
        <Avatar name={op.name} />
        <div className="flex flex-col min-w-0">
          <span className="font-body text-[13px] font-semibold text-text-primary truncate">
            {op.name}
          </span>
          <span className="font-mono text-[10.5px] text-text-secondary">
            +54 9 ••• ••• ••••
          </span>
        </div>
      </header>

      {/* Chat body */}
      <div className="chat-stripe relative bg-[var(--color-chat-bg)] px-3 py-4 flex flex-col gap-2 flex-1">
        <div className="self-center px-3 py-1 rounded-full bg-black/40 border border-[var(--color-border-subtle)]">
          <span className="font-mono text-[9.5px] uppercase tracked-wide text-text-secondary">
            {op.dateLabel}
          </span>
        </div>
        {op.messages.map((m, i) => (
          <MessageBubble key={i} msg={m} cardName={op.product.name} />
        ))}
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-3 px-4 py-3 border-t border-border-subtle">
        {op.product.imageUrl ? (
          <div
            aria-hidden
            className="relative w-9 h-9 rounded-sm bg-bg-elevated border border-border-subtle overflow-hidden shrink-0"
          >
            <Image
              src={op.product.imageUrl}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="foto-stripe relative w-9 h-9 rounded-sm bg-bg-elevated border border-border-subtle grid place-items-center shrink-0"
          >
            <span className="font-mono text-[8px] text-text-secondary">FOTO</span>
          </div>
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-mono text-[9.5px] uppercase tracked-wide text-[var(--color-ink-3)]">
            Compró
          </span>
          {op.product.slug ? (
            <Link
              href={`/products/${op.product.slug}`}
              className="font-body text-[13px] font-semibold text-text-primary hover:text-accent transition-colors truncate"
            >
              {op.product.name}
            </Link>
          ) : (
            <span className="font-body text-[13px] font-semibold text-text-primary truncate">
              {op.product.name}
            </span>
          )}
          <span className="font-mono text-[10.5px] text-text-secondary truncate">
            {op.product.line} · US$ {op.product.price}
          </span>
        </div>
        <span
          aria-label="Venta verificada"
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[9.5px] uppercase tracked-wide"
          style={{
            color: "var(--color-crimson-2)",
            border: "1px solid rgba(192,57,43,0.35)",
            background: "rgba(192,57,43,0.08)",
          }}
        >
          ✓ Venta real
        </span>
      </footer>
    </article>
  );
}

export function Opiniones() {
  const total = OPINIONES.length;
  return (
    <section
      id="opiniones"
      aria-labelledby="opiniones-title"
      className="border-b border-border-subtle"
    >
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        {/* Match the visual rhythm of FeaturedProducts ("Recién agregadas"):
           eyebrow + title only, no lede paragraph. */}
        <header className="flex items-end justify-between mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
              Opiniones
            </span>
            <h2
              id="opiniones-title"
              className="font-display text-4xl md:text-5xl tracked-mid text-text-primary"
            >
              Lo que dicen los que ya compraron
            </h2>
          </div>
        </header>

        {/* Mobile: scroll-snap rail. Desktop: 3-column grid, two rows. */}
        <div
          className="no-scrollbar -mx-6 px-6 flex md:mx-0 md:px-0 md:grid md:grid-cols-3 gap-[14px] md:gap-[18px] overflow-x-auto md:overflow-visible"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {OPINIONES.map((op, i) => (
            <OpinionCard key={i} op={op} />
          ))}
        </div>

        {/* Mobile-only swipe hint */}
        <div className="md:hidden flex items-center justify-between mt-3 font-mono text-[10px] uppercase tracked-wide text-text-secondary">
          <span>Deslizá →</span>
          <span>1 / {total}</span>
        </div>

        <p className="mt-6 font-mono text-[11px] text-[var(--color-ink-3)]">
          Cada opinión corresponde a una venta verificada. Compartidas con
          permiso explícito del comprador.
        </p>
      </div>
    </section>
  );
}
