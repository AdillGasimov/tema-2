"use client";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
export type CartItem = { variantId: string; name: string; variant: string; priceMinor: number; quantity: number; imageKey?: string; slug: string };
const key = "store-cart-v1";
const listeners = new Set<() => void>();
function subscribe(fn: () => void) { listeners.add(fn); window.addEventListener("storage", fn); return () => { listeners.delete(fn); window.removeEventListener("storage", fn); }; }
function snapshot() { return localStorage.getItem(key) ?? "[]"; }
const Context = createContext<{ items: CartItem[]; add: (item: CartItem) => void; quantity: (id: string, n: number) => void; clear: () => void } | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const value = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const items = useMemo<CartItem[]>(() => { try { const data = JSON.parse(value); return Array.isArray(data) ? data.filter(i => typeof i.variantId === "string" && Number.isInteger(i.quantity) && i.quantity > 0).slice(0, 50) : []; } catch { return []; } }, [value]);
  function save(next: CartItem[]) { localStorage.setItem(key, JSON.stringify(next)); listeners.forEach(fn => fn()); }
  return <Context.Provider value={{ items, add(item) { const old = items.find(i => i.variantId === item.variantId); save(old ? items.map(i => i.variantId === item.variantId ? { ...item, quantity: Math.min(100, i.quantity + item.quantity) } : i) : [...items, item]); }, quantity(id, n) { save(n <= 0 ? items.filter(i => i.variantId !== id) : items.map(i => i.variantId === id ? { ...i, quantity: Math.min(100, n) } : i)); }, clear() { save([]); } }}>{children}</Context.Provider>;
}
export function useCart() { const ctx = useContext(Context); if (!ctx) throw new Error("CartProvider missing"); return ctx; }
