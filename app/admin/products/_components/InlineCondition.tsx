"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { patchProduct } from "../../actions";

type Cond = "mint_sealed" | "mint_open" | "near_mint" | "good" | "fair";

const OPTIONS: { value: Cond; label: string }[] = [
  { value: "mint_sealed", label: "mint sealed" },
  { value: "mint_open", label: "mint open" },
  { value: "near_mint", label: "near mint" },
  { value: "good", label: "good" },
  { value: "fair", label: "fair" },
];

const SHORT: Record<Cond, string> = {
  mint_sealed: "mint·s",
  mint_open: "mint·o",
  near_mint: "n.mint",
  good: "good",
  fair: "fair",
};

export function InlineCondition({
  id,
  condition,
}: {
  id: string;
  condition: Cond;
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const onChange = async (next: Cond) => {
    setEditing(false);
    if (next === condition) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("condition", next);
    await patchProduct(fd);
    startTransition(() => router.refresh());
  };

  if (editing) {
    return (
      <select
        className="ah-inline-select"
        defaultValue={condition}
        autoFocus
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange(e.target.value as Cond)}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      className="ah-editable ah-mono"
      onClick={() => setEditing(true)}
      style={{ font: "inherit", border: "none", background: "transparent", cursor: "pointer" }}
    >
      {SHORT[condition]}
    </button>
  );
}
