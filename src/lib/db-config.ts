import type { PoolConfig } from "pg";

export function databasePoolConfig(env: Record<string, string | undefined> = process.env) {
  const max = Number(env.DATABASE_POOL_MAX ?? "1");
  if (!Number.isInteger(max) || max < 1 || max > 10) {
    throw new Error("DATABASE_POOL_MAX must be an integer from 1 to 10.");
  }
  // Each serverless instance has its own pool. Keep its default budget small
  // and release idle connections promptly on databases with tight role limits.
  return { connectionString: env.DATABASE_URL, max, idleTimeoutMillis: 1000, connectionTimeoutMillis: 10000 } satisfies PoolConfig;
}
