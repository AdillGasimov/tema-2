import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";

export async function GET(request: NextRequest) {
  return endpoint(async () => {
    const ids = z.array(z.string().min(1).max(100)).min(1).max(50).parse(request.nextUrl.searchParams.get("ids")?.split(","));
    const variants = await db.productVariant.findMany({ where: { id: { in: ids }, active: true, product: { status: "PUBLISHED", rightsReviewRequired: false } }, select: {
      id: true, name: true, priceMinor: true, discountMinor: true, stock: true, reserved: true,
      product: { select: { name: true, slug: true, images: { orderBy: { position: "asc" }, take: 1, select: { key: true } } } },
    } });
    return variants.map(v => ({ variantId: v.id, name: v.product.name, variant: v.name, priceMinor: v.discountMinor ?? v.priceMinor, maxQuantity: Math.min(100, Math.max(0, v.stock - v.reserved)), imageKey: v.product.images[0]?.key, slug: v.product.slug }));
  });
}
