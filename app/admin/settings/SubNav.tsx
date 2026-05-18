"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Item = { tab: "brands" | "lines" | "series"; label: string; count: number };

export function SubNav({ items }: { items: Item[] }) {
  const sp = useSearchParams();
  const active = (sp.get("tab") as Item["tab"]) || "brands";
  return (
    <nav className="ah-subnav">
      {items.map((it) => (
        <Link
          key={it.tab}
          href={`/admin/settings?tab=${it.tab}`}
          className={`ah-subnav-item${active === it.tab ? " is-active" : ""}`}
        >
          {it.label}
          <span className="ah-subnav-count">{it.count}</span>
        </Link>
      ))}
    </nav>
  );
}
