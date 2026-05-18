"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Tab = "all" | "new" | "in_review";

type Item = { tab: Tab; label: string; count: number };

export function FilterTabs({ items }: { items: Item[] }) {
  const sp = useSearchParams();
  const active = (sp.get("status") as Tab) || "new";
  return (
    <nav className="ah-filter-tabs">
      {items.map((it) => {
        const next = new URLSearchParams(sp.toString());
        if (it.tab === "new") next.delete("status");
        else next.set("status", it.tab);
        next.delete("id");
        return (
          <Link
            key={it.tab}
            href={`/admin/proposals?${next.toString()}`}
            className={`ah-filter-tab${active === it.tab ? " is-active" : ""}`}
          >
            {it.label}
            <span className="ah-filter-tab-count">{it.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
