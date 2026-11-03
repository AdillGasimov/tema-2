import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";
import { databasePoolConfig } from "../../src/lib/db-config";

let admin: Client;
beforeAll(async () => { admin = new Client({ connectionString: process.env.DATABASE_URL }); await admin.connect(); });
afterAll(async () => { await admin.end(); });

describe("database roles with a tight connection limit", () => {
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
  });
});
