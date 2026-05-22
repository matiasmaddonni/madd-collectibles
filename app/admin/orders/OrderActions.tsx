"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOrder, cancelOrder } from "./actions";

export function OrderActions({ intentId }: { intentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (
    fn: (id: string) => Promise<{ ok: true } | { ok: false; reason: string }>,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      const res = await fn(intentId);
      if (!res.ok) {
        setError(res.reason);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="ah-btn ah-btn--ok"
          disabled={pending}
          onClick={() =>
            run(
              approveOrder,
              "Approve this order? The items will be marked SOLD.",
            )
          }
        >
          {pending && <span className="ah-spinner ah-spinner--sm" />}
          Approve · mark sold
        </button>
        <button
          type="button"
          className="ah-btn ah-btn--danger-ghost"
          disabled={pending}
          onClick={() => run(cancelOrder, "Cancel this order?")}
        >
          Cancel
        </button>
      </div>
      {error && (
        <span style={{ fontSize: 12, color: "var(--ah-danger)" }}>{error}</span>
      )}
    </div>
  );
}
