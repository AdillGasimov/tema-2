import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import type { Pool } from "pg";
import { db } from "../../src/lib/db";
import { productAliasTarget } from "../../src/lib/product-routing";
const run = randomUUID().slice(0, 10);
let productId: string;
afterAll(async () => {
  if (productId) await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
  const global = globalThis as unknown as { productRouting?: { pool?: Pool } };
  await global.productRouting?.pool?.end(); delete global.productRouting;
  await db.$disconnect();
});
it("reads the indexed alias directly and immediately respects renamed, draft and rights-held targets", async () => {
  const category = await db.productCategory.create({ data: { name: `Routing ${run}`, slug: `routing-${run}` } });
  const p = await db.product.create({ data: { name: "Test product", slug: `current-${run}`, description: "Test", categoryId: category.id, status: "PUBLISHED" } }); productId = p.id;
  const old = `old-${run}`; await db.productSlugAlias.create({ data: { oldSlug: old, productId: p.id } });
  expect(await productAliasTarget(p.slug)).toBeNull(); expect(await productAliasTarget(old)).toBe(p.slug);
  const updated = `new-${run}`; await db.product.update({ where: { id: p.id }, data: { slug: updated } }); expect(await productAliasTarget(old)).toBe(updated);
  await db.product.update({ where: { id: p.id }, data: { status: "DRAFT" } }); expect(await productAliasTarget(old)).toBeNull();
  await db.product.update({ where: { id: p.id }, data: { status: "PUBLISHED", rightsReviewRequired: true } }); expect(await productAliasTarget(old)).toBeNull();
  await db.product.update({ where: { id: p.id }, data: { rightsReviewRequired: false } }); expect(await productAliasTarget(old)).toBe(updated);
  expect(await productAliasTarget("' OR 1=1 --")).toBeNull();
});
