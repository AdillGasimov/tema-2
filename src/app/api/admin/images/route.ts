import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { endpoint, mutationGuard } from "@/lib/http";
import { imageExists, deleteImage } from "@/lib/storage";
import { db, transaction } from "@/lib/db";
import { audit } from "@/lib/commerce";
import { AppError } from "@/lib/errors";
import { setProductCover } from "@/lib/product-image-order";
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); const user = await requireUser("ADMIN");
  const input = z.discriminatedUnion("action", [
    z.object({ action: z.literal("attach"), productId: z.string(), key: z.string(), alt: z.string().min(1).max(160) }),
    z.object({ action: z.literal("delete"), key: z.string() }),
    z.object({ action: z.literal("cover"), productId: z.string().min(1).max(120), key: z.string().min(1).max(100) }).strict(),
  ]).parse(await req.json());
  await imageExists(input.key);
  if (input.action === "cover") return transaction(async tx => {
    await setProductCover(tx, input.productId, input.key);
    await audit(tx, user.id, "image.cover", "Product", input.productId, { key: input.key });
    return { ok: true };
  });
  if (input.action === "attach") return transaction(async tx => {
    await tx.product.findUniqueOrThrow({ where: { id: input.productId, status: { not: "DELETED" } }, select: { id: true } });
    const count = await tx.productImage.count({ where: { productId: input.productId } });
    if (count >= 12) throw new AppError("Ən çox 12 şəkil əlavə edilə bilər.");
    const result = await tx.productImage.create({ data: { productId: input.productId, key: input.key, alt: input.alt, position: count } });
    await audit(tx, user.id, "image.attach", "Product", input.productId, { key: input.key }); return result;
  });
  const referenced = await db.storeSettings.count({ where: { OR: [{ logoKey: input.key }, { faviconKey: input.key }, { heroImageKey: input.key }] } });
  if (referenced || await db.expense.count({ where: { attachment: input.key } })) throw new AppError("İstifadə edilən şəkil silinə bilməz.");
  await transaction(async tx => { await tx.productImage.deleteMany({ where: { key: input.key } }); await audit(tx, user.id, "image.delete", "Image", input.key); });
  await deleteImage(input.key); return { ok: true };
}); }
