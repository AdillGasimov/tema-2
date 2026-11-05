import type { Tx } from "./db";
import { AppError } from "./errors";

export async function setProductCover(tx: Tx, productId: string, key: string) {
  await tx.product.findUniqueOrThrow({ where: { id: productId, status: { not: "DELETED" } }, select: { id: true } });
  const images = await tx.productImage.findMany({ where: { productId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  const cover = images.find(i => i.key === key);
  if (!cover) throw new AppError("Şəkil bu məhsula aid deyil.");
  const ordered = [cover, ...images.filter(i => i.id !== cover.id)];
  for (const [position, image] of ordered.entries()) if (image.position !== position) await tx.productImage.update({ where: { id: image.id }, data: { position } });
  return ordered.map(i => i.id);
}
