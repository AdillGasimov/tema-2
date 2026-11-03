import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { MAX_PRODUCT_CSV_BYTES } from "@/lib/product-csv";
import { importProducts, previewProductImport } from "@/lib/product-import";

export const maxDuration = 60;
const requestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("preview"), csv: z.string().min(1).max(MAX_PRODUCT_CSV_BYTES), defaultCategoryId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ mode: z.literal("import"), csv: z.string().min(1).max(MAX_PRODUCT_CSV_BYTES), defaultCategoryId: z.string().min(1).max(100).optional(), idempotencyKey: z.uuid() }).strict(),
]);
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); const user = await requireUser("ADMIN"); await rateLimit(req, "product-import", 20);
  const maxBody = MAX_PRODUCT_CSV_BYTES * 2 + 4096;
  const declared = req.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBody)) throw new AppError("CSV sorğusu çox böyükdür.", 413);
  if (!req.body) throw new AppError("CSV faylı seçin.");
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBody) { await reader.cancel(); throw new AppError("CSV sorğusu çox böyükdür.", 413); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let raw: unknown; try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new AppError("CSV sorğusu oxunmadı."); }
  const data = requestSchema.parse(raw);
  return data.mode === "preview" ? previewProductImport(data.csv, data.defaultCategoryId) : importProducts(data.csv, data.defaultCategoryId, data.idempotencyKey, user.id);
}); }
