import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endpoint } from "@/lib/http";
import { imageBytes, validImageKey } from "@/lib/storage";
import { AppError } from "@/lib/errors";
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) { return endpoint(async () => {
  const key = (await ctx.params).key.join("/");
  if (!validImageKey(key)) throw new AppError("Şəkil tapılmadı.", 404);
  const publicImage = await db.productImage.count({ where: { key, product: { status: "PUBLISHED" } } }) || await db.storeSettings.count({ where: { OR: [{ logoKey: key }, { faviconKey: key }, { heroImageKey: key }] } });
  if (!publicImage) await requireUser("ADMIN");
  return new Response(Buffer.from(await imageBytes(key)), { headers: { "Content-Type": "image/webp", "Cache-Control": publicImage ? "public, max-age=3600" : "private, no-store" } });
}); }
