import type { Tx } from "./db";

// Called inside the same product/CSV transaction and slug namespace lock.
// Supplier SKUs remain private matching keys for existing CSV/photo retries.
export async function allocateStoreSkus(tx: Tx, count = 1) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000) throw new Error("Invalid store SKU count.");
  const counter = await tx.storeSkuCounter.upsert({ where: { id: "store" }, create: { id: "store", value: count }, update: { value: { increment: count } } });
  return Array.from({ length: count }, (_, n) => `FC-${String(counter.value - count + n + 1).padStart(4, "0")}`);
}
