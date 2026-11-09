import type { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions/db-connections";

// Keep Prisma out of this module: Node Proxy shares this pool lifecycle helper.
export function manageDatabasePool(pool: Pool) {
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  return pool;
}
