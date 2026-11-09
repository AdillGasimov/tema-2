import type { PoolConfig } from "pg";

export function applicationDatabaseUrl(connection: string | undefined) {
  if (!connection) return connection;
  try {
    const url = new URL(connection);
    // Prisma documents identical credentials for its direct/pooled endpoints.
    // Runtime queries must not consume the small direct/migration budget.
    if (["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "db.prisma.io" && (!url.port || url.port === "5432")) {
      url.hostname = "pooled.db.prisma.io";
      return url.toString();
    }
  } catch { /* Leave other driver-supported formats to pg. */ }
  return connection;
}

export function databasePoolConfig(env: Record<string, string | undefined> = process.env) {
  const max = Number(env.DATABASE_POOL_MAX ?? "1");
  if (!Number.isInteger(max) || max < 1 || max > 10) {
    throw new Error("DATABASE_POOL_MAX must be an integer from 1 to 10.");
  }
  // Each serverless instance has its own pool. Keep its default budget small
  // and release idle connections promptly on databases with tight role limits.
  return { connectionString: applicationDatabaseUrl(env.DATABASE_URL), max, idleTimeoutMillis: 1000, connectionTimeoutMillis: 10000, allowExitOnIdle: true } satisfies PoolConfig;
}
