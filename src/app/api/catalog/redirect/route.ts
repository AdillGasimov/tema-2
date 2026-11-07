import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";

export const runtime = "nodejs";
const slugSchema = z.string().regex(/^[a-z0-9-]{1,180}$/);

export async function GET(request: NextRequest) {
  return endpoint(async () => {
    const slug = slugSchema.parse(request.nextUrl.searchParams.get("slug"));
    const alias = await db.productSlugAlias.findUnique({ where: { oldSlug: slug }, select: { product: { select: { slug: true, status: true, rightsReviewRequired: true } } } });
    return { slug: alias?.product.status === "PUBLISHED" && !alias.product.rightsReviewRequired ? alias.product.slug : null };
  });
}
