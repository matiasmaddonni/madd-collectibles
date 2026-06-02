"use client";

// Inline editor for a pending order's per-item sale prices. Customer
// negotiation usually arrives as "$5 off this, $20 off that", so the
// admin types the agreed numbers directly per row. Live totals show
// the new amount before saving so the math matches what's already
// agreed to in WhatsApp.
//
// Leave a row blank → revert to the asking price.

import { useMemo, useState, useTransition } from "react";
import { updateOrderPricing } from "./actions";
import { formatPrice } from "@/lib/format";

type Item = {
  id: string;
  slug: string | null;
  name: string;
  lineName?: string;
  price: number;
  salePrice?: number | null;
  currency: "ARS" | "USD";
  qty: number;
};

type Props = {
  intentId: string;
  items: Item[];
};

function diffPct(asking: number, sale: number): number {
  if (asking <= 0) return 0;
  return ((sale - asking) / asking) * 100;
}

export function OrderPricingForm({ intentId, items }: Props) {
  // Local string state per row — strings (not numbers) so the input
  // can stay empty while the user types or clears it.
  const [values, setValues] = useState<string[]>(() =>
    items.map((it) =>
      it.salePrice != null && it.salePrice !== it.price
        ? String(it.salePrice)
        : "",
    ),
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveItems = useMemo(
    () =>
      items.map((it, i) => {
        const raw = values[i] ?? "";
        const parsed = raw.trim() === "" ? null : Number(raw);
        const valid = parsed != null && Number.isFinite(parsed) && parsed >= 0;
        return {
          ...it,
          effective: valid ? (parsed as number) : it.price,
          override: valid ? (parsed as number) : null,
        };
      }),
    [items, values],
  );

  const liveTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const it of liveItems) {
      const unit = it.override ?? it.price;
      out[it.currency] = (out[it.currency] ?? 0) + unit * (it.qty || 1);
    }
    return out;
  }, [liveItems]);

  const askingTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const it of items) {
      out[it.currency] = (out[it.currency] ?? 0) + it.price * (it.qty || 1);
    }
    return out;
  }, [items]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await updateOrderPricing(fd);
      if (res.ok) {
        setSavedAt(Date.now());
      } else {
        setError(res.reason);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="ah-order-pricing">
      <input type="hidden" name="intentId" value={intentId} />

      <div className="ah-list">
        {liveItems.map((it, i) => {
          const discountedAmt = (it.price - it.effective) * (it.qty || 1);
          const pct = it.override != null ? diffPct(it.price, it.effective) : 0;
          return (
            <div key={`${it.id}-${i}`} className="ah-list-row">
              <div style={{ flex: 1 }}>
                <div className="ah-list-name">
                  {it.name}
                  {it.qty > 1 ? ` ×${it.qty}` : ""}
                </div>
                {it.lineName && (
                  <div className="ah-list-sub">{it.lineName}</div>
                )}
              </div>

              <div
                className="ah-list-meta"
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  style={{
                    color: "var(--ah-text-3)",
                    textDecoration:
                      it.override != null && it.override !== it.price
                        ? "line-through"
                        : "none",
                    fontSize: 12,
                  }}
                >
                  {formatPrice(it.price, it.currency)}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <input
                    type="number"
                    name={`pricing__${i}`}
                    min={0}
                    step="0.01"
                    placeholder={String(it.price)}
                    value={values[i] ?? ""}
                    onChange={(e) => {
                      const next = [...values];
                      next[i] = e.target.value;
                      setValues(next);
                    }}
                    aria-label={`Sale price for ${it.name}`}
                    className="ah-input"
                    style={{ width: 110, textAlign: "right" }}
                  />
                  {it.override != null && discountedAmt > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ah-success, #34c66a)",
                        textAlign: "right",
                      }}
                    >
                      −{formatPrice(discountedAmt, it.currency)} ({pct.toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="ah-card-head"
        style={{ marginTop: 12, alignItems: "center", gap: 12 }}
      >
        <div>
          <div className="ah-card-sub">Asking total</div>
          <div style={{ fontSize: 13, color: "var(--ah-text-3)" }}>
            {Object.entries(askingTotals)
              .map(([cur, amt]) => formatPrice(amt, cur as "ARS" | "USD"))
              .join(" + ") || "—"}
          </div>
        </div>
        <div>
          <div className="ah-card-sub">Sale total</div>
          <div
            className="ah-h1"
            style={{ fontSize: 18, lineHeight: 1.1 }}
          >
            {Object.entries(liveTotals)
              .map(([cur, amt]) => formatPrice(amt, cur as "ARS" | "USD"))
              .join(" + ") || "—"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {error && (
            <span style={{ color: "var(--ah-danger, #ef4444)", fontSize: 12 }}>
              {error}
            </span>
          )}
          {savedAt && !error && (
            <span style={{ color: "var(--ah-success, #34c66a)", fontSize: 12 }}>
              Saved
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="ah-btn ah-btn--primary"
          >
            {pending ? "Saving…" : "Save prices"}
          </button>
        </div>
      </div>
    </form>
  );
}
