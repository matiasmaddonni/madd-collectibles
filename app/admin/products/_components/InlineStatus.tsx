"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { patchProduct } from "../../actions";

type Status = "draft" | "available" | "reserved" | "sold";

const OPTIONS: { value: Status; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "draft", label: "Draft" },
];

export function InlineStatus({ id, status }: { id: string; status: Status }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = async (next: Status) => {
    setOpen(false);
    if (next === status) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", next);
    await patchProduct(fd);
    startTransition(() => router.refresh());
  };

  return (
    <div className="ah-status-menu" ref={wrapRef}>
      <button
        type="button"
        className={`ah-chip ah-chip--${status} ah-chip--button`}
        onClick={() => setOpen((o) => !o)}
      >
        {status}
      </button>
      {open && (
        <div className="ah-status-pop">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`ah-status-pop-item${o.value === status ? " is-active" : ""}`}
              onClick={() => choose(o.value)}
            >
              <span className={`ah-chip-dot ah-chip-dot--${o.value}`} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
