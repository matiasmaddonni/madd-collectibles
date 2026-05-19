"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ZoomIn, X } from "lucide-react";

// Fullscreen image overlay with click-to-toggle 1x/2x zoom on desktop and
// native pinch-zoom on mobile. Click outside the image OR the X button OR
// pressing Escape closes. The X button sits at z-30 so it always receives
// taps even when the image fills the dialog.
function ZoomOverlay({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const toggleScale = () => setScale((s) => (s === 1 ? 2 : 1));

  return (
    <div
      role="dialog"
      aria-label="Imagen ampliada"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-bg-deep/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out overflow-auto"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed top-4 right-4 z-[210] w-11 h-11 grid place-items-center rounded-sm border border-border-subtle text-text-primary hover:text-accent hover:border-accent transition-colors bg-bg-deep/80"
        style={{ touchAction: "manipulation" }}
      >
        <X size={20} aria-hidden />
      </button>
      <div
        onClick={(e) => {
          e.stopPropagation();
          toggleScale();
        }}
        className={`relative max-w-5xl max-h-full transition-transform duration-200 ${
          scale === 1 ? "cursor-zoom-in" : "cursor-zoom-out"
        }`}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          touchAction: "pinch-zoom",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

type Props = {
  images: string[];
  alt: string;
  sizes?: string;
  // Enable tap-to-zoom fullscreen overlay. Off on storefront cards (whole
  // card is a navigation link), on for product detail page.
  enableZoom?: boolean;
  // Mark the first slide as priority + eager-loaded so it can be the LCP
  // image when this carousel is above the fold (product detail hero, first
  // featured / hero card on home).
  priority?: boolean;
};

const SWIPE_THRESHOLD = 40;

export function CardImageCarousel({
  images,
  alt,
  sizes,
  enableZoom = false,
  priority = false,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const total = images.length;
  const anchorRef = useRef<HTMLSpanElement | null>(null);

  // Lock body scroll while zoom overlay is open + close on Escape.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed]);

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
              quality={90}
              className={`object-cover ${i === idx ? "product-img-zoom" : ""}`}
              priority={priority && i === 0}
              loading={priority && i === 0 ? "eager" : "lazy"}
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
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity hover:text-accent focus-visible:text-accent"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-bg-deep/70 backdrop-blur-sm border border-border-subtle text-text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity hover:text-accent focus-visible:text-accent"
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

      {enableZoom && (
        <button
          type="button"
          aria-label="Ver imagen ampliada"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setZoomed(true);
          }}
          className="absolute bottom-3 right-3 z-20 w-9 h-9 grid place-items-center rounded-sm bg-bg-deep/80 backdrop-blur-sm border border-border-subtle text-text-primary hover:text-accent hover:border-accent transition-colors"
        >
          <ZoomIn size={16} aria-hidden />
        </button>
      )}

      {enableZoom && zoomed && (
        <ZoomOverlay
          src={images[idx]}
          alt={alt}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
}
