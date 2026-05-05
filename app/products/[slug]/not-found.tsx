import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function ProductNotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-24 md:py-32 text-center flex flex-col items-center gap-6">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            404
          </span>
          <h1 className="font-display text-5xl md:text-6xl tracked-mid text-text-primary leading-[0.95]">
            Pieza no encontrada
          </h1>
          <p className="font-body text-text-secondary max-w-md">
            Esa figura no existe o ya no está disponible. Volvé al catálogo
            para ver las piezas activas.
          </p>
          <Link
            href="/"
            className="cta-primary inline-flex items-center gap-2 px-6 h-12 rounded-sm font-mono uppercase tracked-wide text-sm text-text-primary"
          >
            Volver al inicio
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
