"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { patchProduct } from "../../actions";

type Props = {
  id: string;
  price: number;
  currency: string;
};

export function InlinePrice({ id, price, currency }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(String(price));
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Mirror the prop into the controlled input when the parent's `price`
  // changes from outside (e.g. after a different cell saves and the page
  // refreshes). The lint rule discourages setState-in-effect but this is
  // the idiomatic prop->state sync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(String(price));
  }, [price]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n === price) {
      setEditing(false);
      setValue(String(price));
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("price", String(n));
    setSaving(true);
    setEditing(false);
    try {
      await patchProduct(fd);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setValue(String(price));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="1"
        className="ah-inline-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
      />
    );
  }

  if (saving) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="ah-spinner ah-spinner--sm" style={{ color: "var(--ah-accent)" }} />
        <span className="ah-dim">saving</span>
      </span>
    );
  }

  const display = price === 0 ? "—" : price;
  const cls = price === 0 ? "ah-editable ah-warn" : "ah-editable";
  return (
    <button
      type="button"
      className={cls}
      onClick={() => setEditing(true)}
      style={{
        font: "inherit",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: price === 0 ? "var(--ah-warn)" : "inherit",
      }}
    >
      {currency} {display}
    </button>
  );
}
