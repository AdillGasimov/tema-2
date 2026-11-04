import { z } from "zod";
import { transaction } from "./db";
import { audit } from "./commerce";
import { AppError } from "./errors";
import { id } from "./validation";

export const productTrashSchema = z.object({ action: z.enum(["delete", "restore"]), ids: z.array(id).min(1).max(100).transform(ids => [...new Set(ids)]) }).strict();

export async function changeProductTrash(raw: unknown, actorId: string) {
  const input = productTrashSchema.parse(raw);
  return transaction(async tx => {
    const products = await tx.product.findMany({ where: { id: { in: input.ids } }, select: { id: true, name: true, status: true } });
    if (products.length !== input.ids.length) throw new AppError("Məhsul tapılmadı. Siyahını yeniləyin.", 404);
    const changed = products.filter(p => input.action === "delete" ? p.status !== "DELETED" : p.status === "DELETED");
    const status = input.action === "delete" ? "DELETED" : "DRAFT";
    if (changed.length) {
      await tx.product.updateMany({ where: { id: { in: changed.map(p => p.id) } }, data: { status } });
      for (const product of changed) await audit(tx, actorId, `product.${input.action}`, "Product", product.id, { name: product.name, previousStatus: product.status, status });
    }
    // Variants, reservations, images and all historical business records stay
    // intact. A restored product must be reviewed and explicitly published.
    return { count: changed.length };
  });
}
