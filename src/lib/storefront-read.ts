import { Prisma } from "@prisma/client";
import { db } from "./db";
import type { PublicProduct } from "./catalog";

// One round trip for a product and its public relations. Prisma's separate
// relation reads otherwise compete for the same small serverless pool.
const productColumns = Prisma.sql`
  p.id, p.name, p.slug, p.description, p."shortDescription", p.featured,
  p."seoTitle", p."seoDescription",
  jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) AS category,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', i.id, 'key', i.key, 'alt', i.alt, 'position', i.position
  ) ORDER BY i.position ASC, i.id ASC) FROM "ProductImage" i WHERE i."productId" = p.id), '[]'::jsonb) AS images,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', v.id, 'name', v.name, 'storeSku', v."storeSku",
    'priceMinor', v."priceMinor", 'discountMinor', v."discountMinor",
    'stock', v.stock, 'stockVerified', v."stockVerified", 'reserved', v.reserved
  )) FROM "ProductVariant" v
    WHERE v."productId" = p.id AND v.active = true), '[]'::jsonb) AS variants`;

type Reader = Pick<typeof db, "$queryRaw">;
export async function publicProducts({ where = Prisma.sql`true`, take, skip = 0 }: {
  where?: Prisma.Sql; take?: number; skip?: number;
} = {}, reader: Reader = db): Promise<PublicProduct[]> {
  return reader.$queryRaw<PublicProduct[]>(Prisma.sql`
    SELECT ${productColumns} FROM "Product" p
    JOIN "ProductCategory" c ON c.id = p."categoryId"
    WHERE p.status = 'PUBLISHED' AND (${where})
    ORDER BY p."createdAt" DESC, p.id ASC
    ${take === undefined ? Prisma.empty : Prisma.sql`LIMIT ${take}`}
    OFFSET ${skip}`);
}

export async function publicProductCount(where: Prisma.Sql) {
  const rows = await db.$queryRaw<{ total: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS total FROM "Product" p
    JOIN "ProductCategory" c ON c.id = p."categoryId"
    WHERE p.status = 'PUBLISHED' AND (${where})`);
  return rows[0].total;
}

export async function homeCollections(reader: Reader = db) {
  // The union is bounded to eight products and still finds older featured
  // products. Fetching only the latest eight would silently lose those.
  const products = await publicProducts({ where: Prisma.sql`p.id IN (
    (SELECT id FROM "Product" WHERE status = 'PUBLISHED'
      ORDER BY "createdAt" DESC, id ASC LIMIT 4)
    UNION
    (SELECT id FROM "Product" WHERE status = 'PUBLISHED' AND featured = true
      ORDER BY "createdAt" DESC, id ASC LIMIT 4)
  )` }, reader);
  return { arrivals: products.slice(0, 4), featured: products.filter(p => p.featured).slice(0, 4) };
}

export type HomeCategory = { id: string; name: string; slug: string; productCount: number; image: { key: string; alt: string } | null };
export function homeCategories(reader: Reader = db) {
  return reader.$queryRaw<HomeCategory[]>(Prisma.sql`
    SELECT c.id, c.name, c.slug,
      (SELECT COUNT(*)::int FROM "Product" p
        WHERE p."categoryId" = c.id AND p.status = 'PUBLISHED') AS "productCount",
      (SELECT jsonb_build_object('key', i.key, 'alt', i.alt)
        FROM "Product" p JOIN "ProductImage" i ON i."productId" = p.id
        WHERE p."categoryId" = c.id AND p.status = 'PUBLISHED'
        ORDER BY p."createdAt" DESC, p.id ASC, i.position ASC, i.id ASC LIMIT 1) AS image
    FROM "ProductCategory" c WHERE c.featured = true ORDER BY c.name ASC LIMIT 8`);
}
