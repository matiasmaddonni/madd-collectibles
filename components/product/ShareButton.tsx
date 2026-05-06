"use client";

import { useEffect, useState } from "react";
import { Share2, CheckCircle2 } from "lucide-react";

type Props = {
  productName: string;
  slug: string;
};

export function ShareButton({ productName }: Props) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMounted, setToastMounted] = useState(false);

  useEffect(() => {
    if (!toastMounted) return;
    const id = window.setTimeout(() => setToastVisible(false), 2000);
    return () => window.clearTimeout(id);
  }, [toastMounted]);

  useEffect(() => {
    if (toastVisible) return;
    if (!toastMounted) return;
    const id = window.setTimeout(() => setToastMounted(false), 250);
    return () => window.clearTimeout(id);
  }, [toastVisible, toastMounted]);

  const showToast = () => {
    setToastMounted(true);
    requestAnimationFrame(() => setToastVisible(true));
  };

  const onClick = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const shareData = {
      title: productName,
      text: `Mirá esta figura en MADD. — ${productName}`,
      url,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard.
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast();
    } catch {
      // Clipboard blocked. No toast — silent failure.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3 h-9 rounded-sm font-mono text-[11px] uppercase tracked-wide text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-medium transition-colors"
      >
        <Share2 size={14} aria-hidden />
        Compartir
      </button>

      {toastMounted && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-sm bg-[#141416] text-text-primary border-l-2 border-accent shadow-lg transition-opacity duration-200 ${
            toastVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <CheckCircle2 size={16} className="text-accent" aria-hidden />
          <span className="font-body text-sm">¡Link copiado!</span>
        </div>
      )}
    </>
  );
}
