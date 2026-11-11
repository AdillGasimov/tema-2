import { PrismaPg } from "@prisma/adapter-pg";
import { manageDatabasePool, poolState } from "./database-pool";
import type { Pool } from "pg";

async function observed<T>(pool: Pool, operation: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now(), before = poolState(pool);
  try { return await run(); }
  catch (error) {
    const safe = error as { code?: unknown; cause?: { kind?: unknown; originalCode?: unknown } } | null;
    const code = typeof safe?.code === "string" && /^[A-Z0-9_]{1,30}$/.test(safe.code) ? safe.code : undefined;
    const sqlState = typeof safe?.cause?.originalCode === "string" && /^[A-Z0-9]{5}$/.test(safe.cause.originalCode) ? safe.cause.originalCode : undefined;
    console.error("Database operation failed", { operation, elapsedMs: Math.round(performance.now() - started), code, sqlState, before, after: poolState(pool) });
    throw error;
  }
}

export class ServerlessPrismaPg extends PrismaPg {
  override async connect() {
    const adapter = await super.connect();
    const pool = manageDatabasePool(adapter.underlyingDriver());
    const query = adapter.queryRaw.bind(adapter), execute = adapter.executeRaw.bind(adapter), start = adapter.startTransaction.bind(adapter);
    adapter.queryRaw = input => observed(pool, "query", () => query(input));
    adapter.executeRaw = input => observed(pool, "execute", () => execute(input));
    adapter.startTransaction = isolation => observed(pool, "transaction.start", () => start(isolation));
    return adapter;
  }
}
