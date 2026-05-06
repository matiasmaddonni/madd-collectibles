"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook for telemetry: console only in dev.
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <main className="flex-1">
      <section className="max-w-3xl mx-auto px-6 py-24 md:py-32 flex flex-col items-center text-center gap-6">
        <span className="font-mono text-xs uppercase tracked-wide text-text-secondary">
          Error inesperado
        </span>
        <h1 className="font-display text-5xl md:text-7xl tracked-mid text-text-primary leading-[0.95]">
          ALGO SALIÓ MAL
        </h1>
        <p className="font-body text-base text-text-secondary max-w-md">
          Tuvimos un problema cargando esta página. Intentá de nuevo o volvé al
          inicio.
        </p>
        <div className="flex items-center gap-4 mt-2">
          <button
            type="button"
            onClick={reset}
            className="cta-primary font-mono uppercase tracked-wide text-sm px-6 py-3 text-text-primary inline-flex items-center"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Volver al inicio →
          </Link>
        </div>
        {error.digest && (
          <p className="font-mono text-[10px] uppercase tracked-wide text-text-secondary opacity-60 mt-4">
            ref: {error.digest}
          </p>
        )}
      </section>
    </main>
  );
}
