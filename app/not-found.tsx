import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-24 md:py-32 flex flex-col items-center text-center gap-6">
          <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
            Error 404
          </span>
          <h1 className="font-display text-5xl md:text-7xl tracked-mid text-text-primary leading-[0.95]">
            PÁGINA NO ENCONTRADA
          </h1>
          <p className="font-body text-base text-text-secondary max-w-md">
            Esta página no existe o fue movida. Volvé al inicio o explorá el
            catálogo.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Link
              href="/"
              className="cta-primary font-mono uppercase tracked-wide text-sm px-6 py-3 text-text-primary inline-flex items-center"
            >
              Ir al inicio
            </Link>
            <Link
              href="/catalogo"
              className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Ver catálogo →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
