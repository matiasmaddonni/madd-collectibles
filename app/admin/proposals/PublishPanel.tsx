"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishDraftProduct,
  setProductPrice,
  type PublishCheck,
} from "./actions";

type Props = {
  productId: string;
  // Server passes the latest checklist on every render. Don't snapshot
  // it into useState — that would freeze the panel at first render and
  // the checks wouldn't update after Approve/Discard actions revalidate
  // the page.
  initialReadiness: PublishCheck;
};

// Inline price entry shown when the draft has no real price yet.
// Calls setProductPrice + refreshes the page so the readiness check
// flips to ✓ on the same view.
function PriceForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = () => {
    setError(null);
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive number");
      return;
    }
    startTransition(async () => {
      const result = await setProductPrice(productId, n, currency);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setPrice("");
      router.refresh();
    });
  };

  return (
    <div className="ah-price-form">
      <span className="ah-price-form-label">Set price</span>
      <div className="ah-price-form-row">
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 120"
          disabled={pending}
          className="ah-input"
          style={{ flex: 1, minWidth: 120 }}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as "USD" | "ARS")}
          disabled={pending}
          className="ah-input"
        >
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || price.trim().length === 0}
          className="ah-btn"
          style={{
            background: "var(--ah-accent)",
            color: "white",
            borderColor: "var(--ah-accent)",
          }}
        >
          {pending ? "Saving..." : "Save price"}
        </button>
      </div>
      {error && <p className="ah-publish-error">{error}</p>}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`ah-publish-check${ok ? " is-ok" : ""}`}>
      <span aria-hidden className="ah-publish-check-mark">
        {ok ? "✓" : "✗"}
      </span>
      <span>{label}</span>
    </div>
  );
}

// Publish panel for draft products. Shows a readiness checklist + the
// big green button. Disables the button when prerequisites are missing;
// the server action validates again to defend against race conditions.
export function PublishPanel({
  productId,
  initialReadiness: readiness,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onPublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishDraftProduct(productId);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="ah-publish">
      <div>
        <div className="ah-publish-title">Publish to storefront</div>
        <div className="ah-publish-sub">
          Approve fields + images first, then click Publish to flip status from
          <code className="ah-mono"> draft </code>
          to
          <code className="ah-mono"> available</code>.
        </div>
      </div>

      <div className="ah-publish-checks">
        <Check ok={readiness.hasName} label="Name set" />
        <Check ok={readiness.hasPrice} label="Price > 0" />
        <Check
          ok={readiness.hasPrimaryImage}
          label="At least one approved primary image"
        />
        <Check
          ok={readiness.hasDescription}
          label="Description set (recommended)"
        />
      </div>

      {!readiness.hasPrice && <PriceForm productId={productId} />}

      {(readiness.pendingProposals > 0 ||
        readiness.pendingImageCandidates > 0) && (
        <p className="ah-publish-note">
          Heads-up: {readiness.pendingProposals} pending field proposal(s) and{" "}
          {readiness.pendingImageCandidates} candidate image(s) will stay queued
          after publish.
        </p>
      )}
      {error && <p className="ah-publish-error">{error}</p>}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={onPublish}
          disabled={pending || !readiness.ok}
          className="ah-btn"
          style={{
            background: "var(--ah-ok)",
            color: "white",
            borderColor: "var(--ah-ok)",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 500,
            opacity: pending || !readiness.ok ? 0.45 : 1,
            cursor: pending || !readiness.ok ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "Publishing..." : "Publish to storefront"}
        </button>
        {!readiness.ok && (
          <span
            style={{ fontSize: 12.5, color: "var(--ah-danger)" }}
          >
            Fix the items above first.
          </span>
        )}
      </div>
    </section>
  );
}
