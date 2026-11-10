import { describe, expect, it } from "vitest";
import { applicationDatabaseUrl, databasePoolConfig, transactionStartupWait } from "../../src/lib/db-config";

describe("serverless database connection budgets", () => {
  it("keeps the runtime transaction-start budget and allows a bounded wait only in deployment children", () => {
    expect(transactionStartupWait({})).toBe(2000);
    expect(transactionStartupWait({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(2000);
    expect(transactionStartupWait({ DEPLOYMENT_DB_PREPARATION: "true" })).toBe(2000);
    expect(transactionStartupWait({ DEPLOYMENT_DB_PREPARATION: "1" })).toBe(15000);
  });
  it("defaults to one connection per worker", () => {
    expect(databasePoolConfig({}).max).toBe(1);
    expect(databasePoolConfig({}).allowExitOnIdle).toBe(true);
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
