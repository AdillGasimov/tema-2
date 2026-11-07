import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const slug = request.nextUrl.pathname.split("/")[2] ?? "";
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) return NextResponse.next();
  // Keep the database client in a regular Node route. Vercel packages Proxy
  // separately, so importing its generated Prisma runtime here can fail before
  // any page renders even though the same queries work in application routes.
  const lookup = new URL("/api/catalog/redirect", request.url);
  lookup.searchParams.set("slug", slug);
  try {
    const response = await fetch(lookup, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return NextResponse.next();
    const result: unknown = await response.json();
    const target = result && typeof result === "object" && "slug" in result ? result.slug : null;
    if (typeof target !== "string" || !/^[a-z0-9-]{1,180}$/.test(target) || target === slug) return NextResponse.next();
    const destination = request.nextUrl.clone();
    destination.pathname = `/products/${target}`;
    return NextResponse.redirect(destination, { status: 301, headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } });
  } catch {
    // A lookup outage must not take working canonical product pages offline.
    console.error("Product URL history lookup unavailable.");
    return NextResponse.next();
  }
}
export const config = { matcher: ["/products/:slug"] };
