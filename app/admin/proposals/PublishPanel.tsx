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
    <div className="flex flex-col gap-2 border border-zinc-300 bg-white p-3">
      <label className="text-xs font-semibold text-zinc-700">Set price</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 120"
          disabled={pending}
          className="flex-1 border border-zinc-400 px-2 py-1 text-sm"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as "USD" | "ARS")}
          disabled={pending}
          className="border border-zinc-400 px-2 py-1 text-sm"
        >
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || price.trim().length === 0}
          className="px-3 py-1 text-xs bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save price"}
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={`inline-block w-4 text-center font-mono ${
          ok ? "text-green-700" : "text-red-700"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-zinc-700" : "text-red-800"}>{label}</span>
    </li>
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
    <section className="border border-green-300 bg-green-50 p-4 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Publish to storefront</h2>
      <p className="text-sm text-zinc-700">
        Approve fields + images first, then click Publish to flip status
        from <code>draft</code> to <code>available</code>. The item will
        be visible at <code>/products/&lt;slug&gt;</code> immediately.
      </p>
      <ul className="flex flex-col gap-1 pl-1">
        <Check ok={readiness.hasName} label="Name set" />
        <Check ok={readiness.hasPrice} label="Price > 0" />
        <Check
          ok={readiness.hasPrimaryImage}
          label="At least one approved primary image"
        />
        <Check ok={readiness.hasDescription} label="Description set (recommended)" />
      </ul>

      {!readiness.hasPrice && (
        <PriceForm productId={productId} />
      )}
      {(readiness.pendingProposals > 0 ||
        readiness.pendingImageCandidates > 0) && (
        <p className="text-xs text-amber-900 bg-amber-100 border border-amber-200 px-2 py-1">
          Heads-up: {readiness.pendingProposals} pending field proposal(s)
          and {readiness.pendingImageCandidates} candidate image(s) will
          stay queued after publish — approve or discard them above first
          if you want a clean state.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 px-2 py-1">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPublish}
          disabled={pending || !readiness.ok}
          className="px-4 py-2 bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Publishing…" : "Publish to storefront"}
        </button>
        {!readiness.ok && (
          <span className="text-xs text-red-800 self-center">
            Fix the items above first.
          </span>
        )}
      </div>
    </section>
  );
}
