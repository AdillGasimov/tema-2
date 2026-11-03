import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { readJsonBody } from "@/lib/json-body";
import { importProductPhoto, productPhotoInput } from "@/lib/product-photo-import";

export const maxDuration = 60;
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); const user = await requireUser("ADMIN"); await rateLimit(req, "product-import-photo", 120);
  return importProductPhoto(productPhotoInput.parse(await readJsonBody(req, 8192)), user.id);
}); }
