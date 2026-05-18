"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem("adminTheme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const root = document.getElementById("admin-root");
    if (!root) return;
    const attr = root.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") {
      setTheme(attr);
      return;
    }
    // Inline bootstrap didn't fire (soft client-nav into admin). Set attr now.
    const resolved = resolveTheme();
    root.setAttribute("data-theme", resolved);
    setTheme(resolved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.getElementById("admin-root")?.setAttribute("data-theme", next);
    try {
      localStorage.setItem("adminTheme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="ah-icon-btn"
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
