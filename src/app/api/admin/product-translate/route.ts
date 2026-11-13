import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { readJsonBody } from "@/lib/json-body";
import { translateProductText } from "@/lib/product-translation";
import { productTranslationInputSchema } from "@/lib/product-translation-schema";

export const maxDuration = 60;
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); await requireUser("ADMIN");
  await rateLimit(req, "product-translate", 60);
  const input = productTranslationInputSchema.parse(await readJsonBody(req, 64 * 1024));
  // Authentication/rate queries finish before the external service is called.
  // No database transaction or checked-out connection spans this request.
  return translateProductText(input);
}); }
