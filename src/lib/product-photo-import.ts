import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, transaction } from "./db";
import { audit } from "./commerce";
import { AppError } from "./errors";
import { deleteImage, uploadImage } from "./storage";
import { downloadProductPhoto } from "./product-photo-download";
import { MAX_PRODUCT_PHOTOS, productPhotoUrl } from "./product-photo-policy";

export const productPhotoInput = z.object({ sku: z.string().trim().min(1).max(80), url: z.string().min(1).max(2048) }).strict();

export async function importProductPhoto(input: z.infer<typeof productPhotoInput>, actorId: string) {
  const data = productPhotoInput.parse(input), url = productPhotoUrl(data.url);
  const sourceUrlHash = createHash("sha256").update(url).digest("hex");
  const variant = await db.productVariant.findUnique({ where: { sku: data.sku }, select: { productId: true, product: { select: { status: true } } } });
  if (!variant || variant.product.status === "DELETED") throw new AppError("Bu SKU tapılmadı və ya məhsul silinib. Məhsulu əlavə edin və ya Silinmişlər bölməsindən bərpa edin.", 404);
  const productId = variant.productId;
  const where = { productId_sourceUrlHash: { productId, sourceUrlHash } };
  if (await db.productImage.findUnique({ where, select: { id: true } })) return { attached: false };
  if (await db.productImage.count({ where: { productId } }) >= MAX_PRODUCT_PHOTOS) throw new AppError("Bu məhsulda artıq 12 şəkil var.", 409);

  // Never hold a database transaction open while downloading or storing bytes.
  const key = await uploadImage(await downloadProductPhoto(url));
  let retained = false;
  try {
    const result = await transaction(async tx => {
      if (await tx.productImage.findUnique({ where, select: { id: true } })) return { attached: false };
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId, status: { not: "DELETED" } }, select: { name: true } });
      const images = await tx.productImage.findMany({ where: { productId }, select: { position: true } });
      if (images.length >= MAX_PRODUCT_PHOTOS) throw new AppError("Bu məhsulda artıq 12 şəkil var.", 409);
      const position = images.length ? Math.max(...images.map(i => i.position)) + 1 : 0;
      await tx.productImage.create({ data: { productId, key, alt: product.name, position, sourceUrlHash } });
      await audit(tx, actorId, "image.import", "Product", productId, { key, sourceUrlHash, source: "birmarket-csv" });
      return { attached: true };
    });
    retained = result.attached;
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await db.productImage.findUnique({ where, select: { id: true } })) return { attached: false };
    throw error;
  } finally {
    if (!retained) {
      // A lost connection can make a commit outcome uncertain. Never remove an
      // object which was actually attached by that transaction.
      try { if (!await db.productImage.count({ where: { key } })) await deleteImage(key); }
      catch { console.error("Unused imported photo cleanup failed"); }
    }
  }
}
