import { NextRequest, NextResponse } from "next/server";
import { productAliasTarget } from "@/lib/product-routing";

export async function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const slug = request.nextUrl.pathname.split("/")[2] ?? "";
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) return NextResponse.next();
  const started = performance.now();
  let mode = "direct";
  let target: unknown;
  try { target = await productAliasTarget(slug); }
  catch {
    mode = "fallback";
    // Prisma stays in the ordinary Node route if direct lookup is unavailable.
    const lookup = new URL("/api/catalog/redirect", request.url);
    // Standalone servers bind to 0.0.0.0; use a loopback destination for local I/O.
    if (lookup.hostname === "0.0.0.0" || lookup.hostname === "[::]") lookup.hostname = "127.0.0.1";
    lookup.searchParams.set("slug", slug);
    try {
      const response = await fetch(lookup, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!response.ok) return NextResponse.next();
      const result: unknown = await response.json();
      target = result && typeof result === "object" && "slug" in result ? result.slug : null;
    } catch {
      // A lookup outage must not take working canonical product pages offline.
      console.error("Product URL history lookup unavailable.");
      return NextResponse.next();
    }
  }
  const timing = `routing;dur=${(performance.now() - started).toFixed(1)};desc="${mode}"`;
  if (typeof target !== "string" || !/^[a-z0-9-]{1,180}$/.test(target) || target === slug) return NextResponse.next({ headers: { "Server-Timing": timing } });
  const destination = request.nextUrl.clone();
  destination.pathname = `/products/${target}`;
  return NextResponse.redirect(destination, { status: 301, headers: { "Cache-Control": "public, max-age=0, s-maxage=300", "Server-Timing": timing } });
}
export const config = { matcher: ["/products/:slug"] };
