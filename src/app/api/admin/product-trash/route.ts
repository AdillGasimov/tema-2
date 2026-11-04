import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { readJsonBody } from "@/lib/json-body";
import { changeProductTrash } from "@/lib/product-deletion";

export const maxDuration = 60;
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); const user = await requireUser("ADMIN"); await rateLimit(req, "product-trash", 30);
  return changeProductTrash(await readJsonBody(req, 16 * 1024), user.id);
}); }
