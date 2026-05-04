"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  images: string[];
  alt: string;
  sizes?: string;
};

export function CardImageCarousel({ images, alt, sizes }: Props) {
  const [idx, setIdx] = useState(0);
  const total = images.length;

  if (total === 0) return null;

  const go = (next: number) => {
    if (total === 0) return;
    setIdx(((next % total) + total) % total);
  };

  return (
    <>
      {images.map((src, i) => {
        const offset = (i - idx) * 100;
        return (
          <div
            key={src}
            aria-hidden={i !== idx}
            className="absolute inset-0 z-0 pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform"
            style={{ transform: `translate3d(${offset}%, 0, 0)` }}
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes={sizes}
              className="object-cover product-img-zoom"
              priority={i === 0}
            />
          </div>
        );
      })}

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(idx - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Siguiente imagen"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(idx + 1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir a imagen ${i + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  go(i);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === idx ? "bg-text-primary" : "bg-text-primary/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
