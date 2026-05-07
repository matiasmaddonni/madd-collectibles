"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupportedCurrency } from "@/lib/format";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  lineName: string;
  price: number;
  currency: SupportedCurrency;
  imageUrl: string | null;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (item: Omit<CartItem, "qty">) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
// v2 bump: CartItem now requires `slug`. Old v1 entries (no slug) get dropped.
const STORAGE_KEY = "madd:cart:v2";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "qty">) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.id === item.id ? { ...p, qty: p.qty + 1 } : p,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
    setIsOpen(true);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const has = useCallback(
    (id: string) => items.some((i) => i.id === id),
    [items],
  );

  const count = useMemo(
    () => items.reduce((acc, i) => acc + i.qty, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, count, isOpen, open, close, toggle, add, remove, clear, has }),
    [items, count, isOpen, open, close, toggle, add, remove, clear, has],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
