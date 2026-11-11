import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client, Pool, type PoolClient } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";
import { databasePoolConfig } from "../../src/lib/db-config";
import { manageDatabasePool } from "../../src/lib/database-pool";
import { ServerlessPrismaPg } from "../../src/lib/prisma-adapter";

let admin: Client;
beforeAll(async () => { admin = new Client({ connectionString: process.env.DATABASE_URL }); await admin.connect(); });
afterAll(async () => { await admin.end(); });

describe("database roles with a tight connection limit", () => {
  it("serves a read while the other pooled connection is occupied, without exceeding two connections", async () => {
    // Same driver timeout as the incident, shortened to keep the real queue
    // reproduction bounded. The held connection performs no business writes.
    const run = async (max: number) => {
      const pool = new Pool({ ...databasePoolConfig(), max, connectionTimeoutMillis: 150 });
      const held = await pool.connect();
      try {
        const result = await pool.query("SELECT 42 AS value").then(r => r.rows[0].value, error => error.message);
        expect(pool.totalCount).toBeLessThanOrEqual(max);
        return result;
      } finally { held.release(); await pool.end(); }
    };
    expect(await run(1)).toBe("timeout exceeded when trying to connect");
    const pooled = databasePoolConfig({ DATABASE_URL: "postgresql://user:password@pooled.db.prisma.io/postgres" });
    expect(await run(pooled.max)).toBe(42);
  });
  it("keeps a Vercel request alive for idle cleanup while leaving checked-out connections usable", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_URL", "pool-test.example"); vi.stubEnv("VERCEL_REGION", "fra1");
    const symbol = Symbol.for("@vercel/request-context"), previous = Reflect.get(globalThis, symbol);
    const tasks: Promise<unknown>[] = [];
    Reflect.set(globalThis, symbol, { get: () => ({ waitUntil: (task: Promise<unknown>) => tasks.push(task) }) });
    const pool = manageDatabasePool(new Pool({ ...databasePoolConfig(), idleTimeoutMillis: 40 }));
    let held: PoolClient | undefined;
    try {
      await pool.query("SELECT 1"); expect(tasks.length).toBeGreaterThan(0);
      held = await pool.connect();
      await Promise.all([...tasks]);
      expect(pool.totalCount).toBe(1); expect((await held.query("SELECT 2 AS value")).rows[0].value).toBe(2);
      held.release(); held = undefined;
      await Promise.all(tasks);
      expect(pool.totalCount).toBe(0);
    } finally {
      held?.release(); await pool.end();
      Reflect.set(globalThis, symbol, previous); vi.unstubAllEnvs();
    }
  });
  it("recreates and disposes the managed Prisma pool when a client reconnects", async () => {
    const client = new PrismaClient({ adapter: new ServerlessPrismaPg(databasePoolConfig()), log: [] });
    try {
      expect(await client.$queryRaw`SELECT 1 AS value`).toEqual([{ value: 1 }]);
      await client.$disconnect();
      expect(await client.$queryRaw`SELECT 2 AS value`).toEqual([{ value: 2 }]);
    } finally { await client.$disconnect(); }
  });
  it("reproduces exhaustion with the old default and serves parallel queries within the application budget", async () => {
    const role = `pool_budget_${randomBytes(5).toString("hex")}_test`;
    const password = randomBytes(24).toString("hex");
    // Identifiers/password use only locally generated hex, never user input.
    await admin.query(`CREATE ROLE "${role}" LOGIN CONNECTION LIMIT 2 PASSWORD '${password}'`);
    const url = new URL(process.env.DATABASE_URL!); url.username = role; url.password = password;
    const run = async (max: number) => {
      const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max }), log: [] });
      try { return await Promise.allSettled(Array.from({ length: 12 }, () => db.$executeRaw`SELECT pg_sleep(0.04)`)); }
      finally { await db.$disconnect(); }
    };
    const unbounded = await run(10);
    expect(unbounded.some(result => result.status === "rejected")).toBe(true);
    expect(unbounded.some(result => result.status === "fulfilled")).toBe(true);
    const config = databasePoolConfig({ DATABASE_URL: url.toString() });
    const bounded = await run(config.max);
    expect(bounded.every(result => result.status === "fulfilled")).toBe(true);
    const pooledBudget = databasePoolConfig({ DATABASE_URL: "postgresql://user:password@pooled.db.prisma.io/postgres" }).max;
    expect((await run(pooledBudget)).every(result => result.status === "fulfilled")).toBe(true);
  });
});
