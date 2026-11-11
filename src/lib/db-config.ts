import type { PoolConfig } from "pg";

export function transactionStartupWait(env: Record<string, string | undefined> = process.env) {
  // Only the trusted deployment runner sets this in its short-lived children.
  return env.DEPLOYMENT_DB_PREPARATION === "1" ? 15000 : 2000;
}

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

export function deploymentDatabaseUrl(connection: string | undefined) {
  if (!connection) return connection;
  try {
    const url = new URL(connection);
    if (["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "pooled.db.prisma.io" && (!url.port || url.port === "5432")) {
      url.hostname = "db.prisma.io";
      return url.toString();
    }
  } catch { /* Preserve other provider/driver-supported connection formats. */ }
  return connection;
}

export function databasePoolConfig(env: Record<string, string | undefined> = process.env) {
  const connectionString = env.DEPLOYMENT_DB_PREPARATION === "1" ? deploymentDatabaseUrl(env.DATABASE_URL) : applicationDatabaseUrl(env.DATABASE_URL);
  let transactionPooled = false;
  try {
    const url = new URL(connectionString ?? "");
    transactionPooled = ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "pooled.db.prisma.io" && (!url.port || url.port === "5432");
  } catch { /* Other configured endpoints keep the conservative budget. */ }
  const max = Number(env.DATABASE_POOL_MAX ?? (transactionPooled && env.DEPLOYMENT_DB_PREPARATION !== "1" ? "2" : "1"));
  if (!Number.isInteger(max) || max < 1 || max > 10) {
    throw new Error("DATABASE_POOL_MAX must be an integer from 1 to 10.");
  }
  // Direct/unknown endpoints keep one connection. Prisma's transaction pool
  // permits two so an occupied connection cannot block every public read.
  // Sequential deployment setup uses the original connection, just like SQL
  // migrations. Only request-serving workers need the transaction pool.
  return { connectionString, max, idleTimeoutMillis: 1000, connectionTimeoutMillis: 10000, allowExitOnIdle: true } satisfies PoolConfig;
}
