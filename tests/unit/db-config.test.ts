import { describe, expect, it } from "vitest";
import { applicationDatabaseUrl, databasePoolConfig, deploymentDatabaseUrl, transactionStartupWait } from "../../src/lib/db-config";

describe("serverless database connection budgets", () => {
  it("keeps the runtime transaction-start budget and allows a bounded wait only in deployment children", () => {
    expect(transactionStartupWait({})).toBe(2000);
    expect(transactionStartupWait({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(2000);
    expect(transactionStartupWait({ DEPLOYMENT_DB_PREPARATION: "true" })).toBe(2000);
    expect(transactionStartupWait({ DEPLOYMENT_DB_PREPARATION: "1" })).toBe(15000);
  });
  it("defaults to one connection on direct or unknown endpoints", () => {
    expect(databasePoolConfig({}).max).toBe(1);
    expect(databasePoolConfig({}).allowExitOnIdle).toBe(true);
  });
  it("allows two connections only on the documented Prisma transaction pool", () => {
    for (const host of ["db.prisma.io", "pooled.db.prisma.io"]) {
      const env = { DATABASE_URL: `postgresql://user:password@${host}:5432/postgres?sslmode=verify-full` };
      expect(databasePoolConfig(env).max).toBe(2);
      expect(databasePoolConfig({ ...env, DEPLOYMENT_DB_PREPARATION: "1" }).max).toBe(1);
      expect(databasePoolConfig({ ...env, DATABASE_POOL_MAX: "1" }).max).toBe(1);
    }
    for (const connection of ["postgresql://user:password@pooled.db.prisma.io:6432/store", "postgresql://user:password@other.example/store"]) {
      expect(databasePoolConfig({ DATABASE_URL: connection }).max).toBe(1);
    }
  });
  it("uses the original migration connection for sequential build setup while keeping request workers pooled", () => {
    const connection = "postgresql://user:encoded%2Fpassword@db.prisma.io:5432/postgres?sslmode=verify-full";
    const pooled = connection.replace("@db.prisma.io:", "@pooled.db.prisma.io:");
    for (const configured of [connection, pooled]) {
      const env = { DATABASE_URL: configured };
      expect(databasePoolConfig({ ...env, DEPLOYMENT_DB_PREPARATION: "1" }).connectionString).toBe(connection);
      expect(databasePoolConfig(env).connectionString).toBe(pooled);
      expect(env.DATABASE_URL).toBe(configured);
    }
    for (const other of ["postgresql://localhost/store_test", "postgresql://user:password@custom.example/store", "postgresql://user:password@pooled.db.prisma.io:6432/store", undefined]) expect(deploymentDatabaseUrl(other)).toBe(other);
  });
  it.each(["postgres", "postgresql"])("uses Prisma's documented pooled %s endpoint without changing credentials or TLS", protocol => {
    const direct = `${protocol}://user:encoded%2Fpassword@db.prisma.io:5432/postgres?sslmode=verify-full&application_name=store`;
    const expected = direct.replace("@db.prisma.io:", "@pooled.db.prisma.io:");
    expect(applicationDatabaseUrl(direct)).toBe(expected);
    expect(databasePoolConfig({ DATABASE_URL: direct }).connectionString).toBe(expected);
  });
  it.each([
    "postgres://user:password@pooled.db.prisma.io:5432/postgres?sslmode=require",
    "postgresql://localhost/operator_test", "postgres://user:password@custom.example:5432/store",
    "postgres://user:password@db.prisma.io.example:5432/store", "postgres://user:password@db.prisma.io:6432/store",
    "prisma+postgres://accelerate.prisma-data.net/?api_key=test", undefined,
  ])("leaves explicitly pooled or other configured endpoints unchanged", connection => {
    expect(applicationDatabaseUrl(connection)).toBe(connection);
  });
  it("accepts an explicit operator budget and preserves the configured endpoint", () => {
    const connection = "postgresql://localhost/operator_test";
    for (const value of ["1", "2", "10"]) {
      const config = databasePoolConfig({ DATABASE_POOL_MAX: value, DATABASE_URL: connection });
      expect(config.max).toBe(Number(value)); expect(config.connectionString).toBe(connection);
    }
  });
  it.each(["", "0", "-1", "1.5", "NaN", "11"])("rejects an invalid pool budget: %s", value => {
    expect(() => databasePoolConfig({ DATABASE_POOL_MAX: value })).toThrow("DATABASE_POOL_MAX");
  });
});
