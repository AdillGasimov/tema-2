import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "../../src/lib/db";
import { databasePoolConfig } from "../../src/lib/db-config";
import { ServerlessPrismaPg } from "../../src/lib/prisma-adapter";
import { catalog, publicProductSelect, type PublicProduct } from "../../src/lib/catalog";
import { homeCategories, homeCollections, publicProducts } from "../../src/lib/storefront-read";
import { availability } from "../../src/lib/availability";

const run = randomUUID(), ids: string[] = [];
let categoryId: string, draftId: string;
const queries: string[] = [];
const observed = new PrismaClient({ adapter: new ServerlessPrismaPg(databasePoolConfig()), log: [{ level: "query", emit: "event" }] });
observed.$on("query", event => queries.push(event.query));
beforeAll(async () => {
  categoryId = (await db.productCategory.create({ data: { name: `000 Oxu ${run}`, slug: `read-${run}`, featured: true } })).id;
  for (let n = 0; n < 15; n++) {
    const p = await db.product.create({ data: {
      name: n === 0 ? `Dəsmal 100% _ ' ${run}` : `Ətir ${n} ${run}`, slug: `read-${run}-${n}`, categoryId,
      description: "Azərbaycan dilində təsvir", shortDescription: "Qısa məlumat", seoTitle: "Başlıq", seoDescription: "SEO təsviri",
      featured: n < 2, status: "PUBLISHED", createdAt: new Date(Date.now() + 3600000 + n * 1000),
      images: { create: [2, 0].map(position => ({ key: `images/${randomUUID()}.webp`, alt: `Şəkil ${position}`, position })) },
      variants: { create: [
        { sku: `private-${run}-${n}`, storeSku: `FC-READ-${run}-${n}`, name: "Standart", priceMinor: 1200 + n * 100, discountMinor: 900 + n * 100, costMinor: 123, commissionMinor: 75, stock: 4, reserved: 1 },
        { sku: `second-${run}-${n}`, name: "Böyük", priceMinor: 2500 + n * 100, costMinor: 500, stock: 0 },
        { sku: `inactive-${run}-${n}`, name: "Gizli", priceMinor: 1, costMinor: 1, stock: 9, active: false },
      ] },
    } });
    ids.push(p.id);
  }
  draftId = (await db.product.create({ data: { name: `Draft ${run}`, slug: `draft-${run}`, categoryId, description: "private", featured: true, status: "DRAFT" } })).id;
});
afterAll(async () => {
  await db.product.updateMany({ where: { id: { in: [...ids, draftId] } }, data: { status: "ARCHIVED" } });
  await db.productCategory.update({ where: { id: categoryId }, data: { featured: false } });
  await observed.$disconnect(); await db.$disconnect();
});
const stable = (products: PublicProduct[]) => products.map(p => ({ ...p, variants: [...p.variants].sort((a, b) => a.id.localeCompare(b.id)) }));
const query = (input: Record<string, string> = {}) => new URLSearchParams({ category: `read-${run}`, ...input });

describe("live storefront reads with fewer database round trips", () => {
  it("returns the identical safe product projection in one SQL statement instead of separate relation reads", async () => {
    queries.length = 0;
    const old = await observed.product.findMany({ where: { categoryId, status: "PUBLISHED" }, select: publicProductSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
    const previousCount = queries.length;
    queries.length = 0;
    const products = await publicProducts({ where: Prisma.sql`c.id = ${categoryId}` }, observed);
    expect(queries).toHaveLength(1); expect(previousCount).toBeGreaterThan(1);
    expect(stable(products)).toEqual(stable(old));
    expect(products[0].images.map(i => i.position)).toEqual([0, 2]);
    expect(products[0].variants).toHaveLength(2);
    for (const variant of products.flatMap(p => p.variants)) {
      expect(variant).not.toHaveProperty("sku"); expect(variant).not.toHaveProperty("costMinor"); expect(variant).not.toHaveProperty("commissionMinor");
    }
  });
  it("keeps older featured products and newest arrivals in one bounded homepage query", async () => {
    queries.length = 0;
    const collections = await homeCollections(observed);
    expect(queries).toHaveLength(1);
    expect(collections.arrivals.map(p => p.id)).toEqual(ids.slice(-4).reverse());
    expect(collections.featured.slice(0, 2).map(p => p.id)).toEqual(ids.slice(0, 2).reverse());
    expect([...collections.arrivals, ...collections.featured].every(p => p.id !== draftId)).toBe(true);
    queries.length = 0;
    const categories = await homeCategories(observed);
    expect(queries).toHaveLength(1);
    expect(categories.find(c => c.id === categoryId)).toMatchObject({ productCount: 15, image: { alt: "Şəkil 0" } });
  });
  it("preserves pagination, AZ sorting, discounts, price bounds and literal parameterized search", async () => {
    const second = await catalog(query({ page: "2" }));
    expect(second).toMatchObject({ total: 15, page: 2 }); expect(second.products.map(p => p.id)).toEqual(ids.slice(0, 3).reverse());
    const cheap = await catalog(query({ sort: "price-asc" })); expect(cheap.products[0].id).toBe(ids[0]);
    const expensive = await catalog(query({ sort: "price-desc" })); expect(expensive.products[0].id).toBe(ids[14]);
    const narrow = await catalog(query({ min: "8.99", max: "9.00" })); expect(narrow.products.map(p => p.id)).toEqual([ids[0]]); expect(narrow.products[0].variants).toHaveLength(1);
    for (const q of ["100%", "_", "'"]) expect((await catalog(query({ q }))).products.map(p => p.id)).toEqual([ids[0]]);
    expect((await catalog(query({ q: "' OR 1=1 --" }))).total).toBe(0);
    const names = await catalog(query({ sort: "name" }));
    const all = await publicProducts({ where: Prisma.sql`c.id = ${categoryId}` });
    const collator = new Intl.Collator("az", { sensitivity: "base", numeric: true });
    expect(names.products.map(p => p.name)).toEqual(all.map(p => p.name).sort(collator.compare).slice(0, 12));
  });
  it("immediately sees price, stock reservations and withdrawal without a stale catalog cache", async () => {
    const before = (await publicProducts({ where: Prisma.sql`p.id = ${ids[0]}` }))[0];
    const variant = before.variants.find(v => v.stock > 0)!;
    await db.productVariant.update({ where: { id: variant.id }, data: { reserved: 4, priceMinor: 1999, discountMinor: null } });
    const current = (await publicProducts({ where: Prisma.sql`p.id = ${ids[0]}` }))[0];
    expect(current.variants.find(v => v.id === variant.id)).toMatchObject({ priceMinor: 1999, discountMinor: null, reserved: 4 });
    expect(availability(current.variants).schema).toContain("OutOfStock");
    await db.product.update({ where: { id: ids[0] }, data: { status: "DRAFT" } });
    expect(await publicProducts({ where: Prisma.sql`p.id = ${ids[0]}` })).toEqual([]);
    expect((await catalog(query())).total).toBe(14);
  });
});
