import type { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions/db-connections";

const managed = new WeakSet<Pool>();
const leases = new WeakMap<object, number>();
export const poolState = (pool: Pool) => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max });

// Keep Prisma out of this module: Node Proxy shares this pool lifecycle helper.
export function manageDatabasePool(pool: Pool) {
  if (managed.has(pool)) return pool;
  managed.add(pool);
  pool.on("acquire", client => leases.set(client, performance.now()));
  pool.on("release", (_error, client) => {
    const started = client && leases.get(client);
    if (started !== undefined && performance.now() - started >= 3000 && pool.waitingCount > 0) {
      // No SQL, credentials, query values or customer data in operational logs.
      console.warn("Database connection occupied while requests wait", { heldMs: Math.round(performance.now() - started), pool: poolState(pool) });
    }
    if (client) leases.delete(client);
  });
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  return pool;
}
