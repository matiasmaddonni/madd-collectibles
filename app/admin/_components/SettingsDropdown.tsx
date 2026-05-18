"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  counts: { brands: number; lines: number; series: number };
};

const items = [
  { tab: "brands", label: "Brands" },
  { tab: "lines", label: "Lines" },
  { tab: "series", label: "Series" },
] as const;

export function SettingsDropdown({ counts }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = pathname.startsWith("/admin/settings");

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="ah-settings-wrap" ref={ref}>
      <button
        type="button"
        className={`ah-nav-item ah-nav-item--dropdown${active ? " is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        Settings
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4 }}>
          <path
            d="M2 3.5 5 6.5 8 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="ah-settings-menu" role="menu">
          {items.map((item) => (
            <Link
              key={item.tab}
              href={`/admin/settings?tab=${item.tab}`}
              className="ah-settings-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span>{item.label}</span>
              <span className="ah-settings-count">{counts[item.tab]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
