"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = {
  label: string;
  sortKey: string;
};

export function SortableHeader({ label, sortKey }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const currentSort = sp.get("sort") ?? "updated";
  const currentDir = (sp.get("dir") as "asc" | "desc") ?? "desc";
  const active = currentSort === sortKey;
  const nextDir: "asc" | "desc" = active
    ? currentDir === "desc"
      ? "asc"
      : "desc"
    : "desc";

  const onClick = () => {
    const next = new URLSearchParams(sp.toString());
    next.set("sort", sortKey);
    next.set("dir", nextDir);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <button type="button" className="ah-th-sortable" onClick={onClick}>
      {label}
      {active && (
        <span className="ah-th-arrow">{currentDir === "desc" ? "↓" : "↑"}</span>
      )}
    </button>
  );
}
