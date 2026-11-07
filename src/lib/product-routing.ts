import type { Pool as PgPool } from "pg";
import { databasePoolConfig } from "./db-config";

const globalRouting = globalThis as unknown as { productRouting?: { pool?: PgPool; retryAfter: number } };
const state = globalRouting.productRouting ??= { retryAfter: 0 };

// This small Node-only driver avoids bundling Prisma's generated client into
// Proxy and avoids a second public HTTP/function round-trip on every product.
export async function productAliasTarget(slug: string): Promise<string | null> {
  if (state.retryAfter > Date.now()) throw new Error("Direct routing is temporarily unavailable.");
  try {
    if (!process.env.DATABASE_URL) throw new Error("Database configuration unavailable.");
    if (!state.pool) {
      const { Pool } = await import("pg");
      // Concurrent first requests can resume after this import together.
      if (!state.pool) {
        state.pool = new Pool({ ...databasePoolConfig(), max: 1, connectionTimeoutMillis: 1200, query_timeout: 1200, statement_timeout: 1200, allowExitOnIdle: true });
        state.pool.on("error", () => { state.retryAfter = Date.now() + 60000; });
      }
    }
    const result = await state.pool.query<{ slug: string }>(
      'SELECT p.slug FROM "ProductSlugAlias" a JOIN "Product" p ON p.id = a."productId" WHERE a."oldSlug" = $1 AND p.status = $2 AND p."rightsReviewRequired" = false LIMIT 1',
      [slug, "PUBLISHED"],
    );
    return result.rows[0]?.slug ?? null;
  } catch (error) {
    // The existing Node API remains a compatibility fallback. Avoid repeatedly
    // paying a connection timeout if this deployment cannot use the direct path.
    state.retryAfter = Date.now() + 60000;
    throw error;
  }
}
