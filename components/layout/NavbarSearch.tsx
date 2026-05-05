"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function NavbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const initial =
    pathname === "/catalogo" ? (params.get("q") ?? "") : "";
  const [term, setTerm] = useState(initial);

  useEffect(() => {
    if (pathname === "/catalogo") setTerm(params.get("q") ?? "");
  }, [pathname, params]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = term.trim();
    const href = trimmed
      ? `/catalogo?q=${encodeURIComponent(trimmed)}`
      : "/catalogo";
    router.push(href);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="hidden md:flex flex-1 max-w-xl mx-auto"
    >
      <label className="flex items-center gap-2 w-full px-3 py-2 bg-bg-surface border border-border-subtle rounded-sm text-text-secondary focus-within:border-border-medium">
        <SearchIcon />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscá figuras, líneas, series…"
          aria-label="Buscar"
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
        />
      </label>
    </form>
  );
}
