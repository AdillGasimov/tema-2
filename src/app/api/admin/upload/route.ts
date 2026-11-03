import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { endpoint, rateLimit } from "@/lib/http";
import { uploadImage } from "@/lib/storage";
import { AppError } from "@/lib/errors";
import { trustedOrigins } from "@/lib/site";
import { readImageForm } from "@/lib/upload-body";
export async function POST(req: NextRequest) { return endpoint(async () => {
  const origin = req.headers.get("origin");
  if (!origin || !trustedOrigins().includes(origin)) throw new AppError("İcazəsiz sorğu.", 403);
  await requireUser("ADMIN"); await rateLimit(req, "upload", 20);
  const data = await readImageForm(req); const file = data.get("file");
  if (!(file instanceof File)) throw new AppError("Şəkil faylı seçin.");
  return { key: await uploadImage(file) };
}); }
