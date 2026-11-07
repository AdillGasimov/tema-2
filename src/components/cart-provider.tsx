"use client";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
export type CartItem = { variantId: string; name: string; variant: string; priceMinor: number; quantity: number; imageKey?: string; slug: string; maxQuantity?: number };
const key = "store-cart-v1";
const listeners = new Set<() => void>();
function subscribe(fn: () => void) { listeners.add(fn); window.addEventListener("storage", fn); return () => { listeners.delete(fn); window.removeEventListener("storage", fn); }; }
function snapshot() { return localStorage.getItem(key) ?? "[]"; }
function save(next: CartItem[]) { localStorage.setItem(key, JSON.stringify(next)); listeners.forEach(fn => fn()); }
const Context = createContext<{ items: CartItem[]; add: (item: CartItem, maximum?: number) => void; quantity: (id: string, n: number) => void; clear: () => void } | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const value = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const items = useMemo<CartItem[]>(() => { try { const data = JSON.parse(value); return Array.isArray(data) ? data.filter(i => typeof i.variantId === "string" && Number.isInteger(i.quantity) && i.quantity > 0).slice(0, 50) : []; } catch { return []; } }, [value]);
  const variantIds = items.map(item => item.variantId).sort().join(",");
  useEffect(() => {
    if (!variantIds) return;
    let cancelled = false;
    const requested = new Set(variantIds.split(","));
    async function refresh() {
      try {
        const response = await fetch(`/api/catalog/quote?${new URLSearchParams({ ids: variantIds })}`, { cache: "no-store" });
        if (!response.ok) return;
        const quotes = await response.json() as (Omit<CartItem, "quantity"> & { maxQuantity: number })[];
        if (cancelled || !Array.isArray(quotes)) return;
        // Read the latest local quantities; the request may overlap a button click.
        const current = JSON.parse(snapshot()) as CartItem[];
        if (!Array.isArray(current)) return;
        const updated = current.flatMap(item => {
          if (!requested.has(item.variantId)) return [item];
          const quote = quotes.find(v => v.variantId === item.variantId);
          return quote && quote.maxQuantity > 0 ? [{ ...item, ...quote, quantity: Math.min(item.quantity, quote.maxQuantity) }] : [];
        });
        save(updated);
      } catch { /* Keep the device cart during a network outage; checkout revalidates. */ }
    }
    void refresh(); window.addEventListener("focus", refresh);
    return () => { cancelled = true; window.removeEventListener("focus", refresh); };
  }, [variantIds]);
  return <Context.Provider value={{ items, add(item, maximum = 100) { const limit = Math.max(0, Math.min(100, maximum)); if (limit < 1) return; const old = items.find(i => i.variantId === item.variantId); save(old ? items.map(i => i.variantId === item.variantId ? { ...item, maxQuantity: limit, quantity: Math.min(limit, i.quantity + item.quantity) } : i) : [...items, { ...item, maxQuantity: limit, quantity: Math.min(limit, item.quantity) }]); }, quantity(id, n) { save(n <= 0 ? items.filter(i => i.variantId !== id) : items.map(i => i.variantId === id ? { ...i, quantity: Math.min(100, i.maxQuantity ?? 100, n) } : i)); }, clear() { save([]); } }}>{children}</Context.Provider>;
}
export function useCart() { const ctx = useContext(Context); if (!ctx) throw new Error("CartProvider missing"); return ctx; }
