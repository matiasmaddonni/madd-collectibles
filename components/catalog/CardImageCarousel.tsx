"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  alt: string;
  sizes?: string;
};

const SWIPE_THRESHOLD = 40;

export function CardImageCarousel({ images, alt, sizes }: Props) {
  const [idx, setIdx] = useState(0);
  const total = images.length;
  const anchorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (total <= 1) return;
    const parent = anchorRef.current?.parentElement;
    if (!parent) return;

    let startX: number | null = null;
    let startY: number | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (startX == null || startY == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      startX = null;
      startY = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) < Math.abs(dy)) return;
      setIdx((cur) => {
        const next = dx < 0 ? cur + 1 : cur - 1;
        return ((next % total) + total) % total;
      });
    };

    parent.addEventListener("touchstart", onStart, { passive: true });
    parent.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      parent.removeEventListener("touchstart", onStart);
      parent.removeEventListener("touchend", onEnd);
    };
  }, [total]);

  if (total === 0) return null;

  const go = (next: number) => {
    if (total === 0) return;
    setIdx(((next % total) + total) % total);
  };

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />

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
              className={`object-cover ${i === idx ? "product-img-zoom" : ""}`}
              priority={i === 0}
            />
          </div>
        );
      })}

      {total > 1 && (
        <>
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-12 z-10 pointer-events-none bg-gradient-to-t from-bg-deep/70 via-bg-deep/30 to-transparent"
          />

          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(idx - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-accent"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-accent"
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
