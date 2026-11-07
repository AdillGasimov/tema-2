import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const slug = request.nextUrl.pathname.split("/")[2] ?? "";
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) return NextResponse.next();
  const alias = await db.productSlugAlias.findUnique({ where: { oldSlug: slug }, select: { product: { select: { slug: true, status: true } } } });
  if (!alias || alias.product.status !== "PUBLISHED" || alias.product.slug === slug) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = `/products/${alias.product.slug}`;
  return NextResponse.redirect(destination, { status: 301, headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } });
}
export const config = { matcher: ["/products/:slug"] };
