import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { MAX_PRODUCT_CSV_BYTES } from "@/lib/product-csv";
import { importProducts, previewProductImport, previewPhotoImport } from "@/lib/product-import";
import { readJsonBody } from "@/lib/json-body";

export const maxDuration = 60;
const requestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("preview"), kind: z.enum(["products", "photos"]).default("products"), csv: z.string().min(1).max(MAX_PRODUCT_CSV_BYTES), defaultCategoryId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ mode: z.literal("import"), csv: z.string().min(1).max(MAX_PRODUCT_CSV_BYTES), defaultCategoryId: z.string().min(1).max(100).optional(), idempotencyKey: z.uuid() }).strict(),
]);
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); const user = await requireUser("ADMIN"); await rateLimit(req, "product-import", 20);
  const data = requestSchema.parse(await readJsonBody(req, MAX_PRODUCT_CSV_BYTES * 2 + 4096));
  if (data.mode === "preview") return data.kind === "photos" ? previewPhotoImport(data.csv) : previewProductImport(data.csv, data.defaultCategoryId);
  return importProducts(data.csv, data.defaultCategoryId, data.idempotencyKey, user.id);
}); }
