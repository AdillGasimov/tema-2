import { describe, expect, it } from "vitest";
import { databasePoolConfig } from "../../src/lib/db-config";

describe("serverless database connection budgets", () => {
  it("defaults to one connection per worker", () => {
    expect(databasePoolConfig({}).max).toBe(1);
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
