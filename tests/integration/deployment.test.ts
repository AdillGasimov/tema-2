import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

let admin: Client;
const clients: Client[] = [];
beforeAll(async () => {
  admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
});
afterAll(async () => {
  for (const client of clients) await client.end();
  await admin.end();
});

async function freshDatabase() {
  const name = `vercel_${randomBytes(6).toString("hex")}_test`;
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect(); clients.push(client);
  return { url: url.toString(), client };
}
function prepare(url: string, target = "production") {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/prepare-vercel.ts"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 20000,
    env: { ...process.env, DATABASE_URL: url, VERCEL: "1", VERCEL_ENV: target,
      BETTER_AUTH_URL: "https://deployment-staging.example.test", SKIP_DEPLOY_DB_SETUP: "0",
      // Database initialization must not require, provision or contact object storage.
      S3_ENDPOINT: "http://127.0.0.1:1", S3_ACCESS_KEY_ID: "unused-test", S3_SECRET_ACCESS_KEY: "unused-test" },
  });
}
describe("Vercel initialization against real fresh PostgreSQL databases", () => {
  it("creates the missing schema and seeds settings once, preserving edits and financial policy on redeployment", async () => {
    const { url, client } = await freshDatabase();
    const first = prepare(url);
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    const store = await client.query('SELECT "brandName", domain FROM "StoreSettings" WHERE id = $1', ["store"]);
    expect(store.rowCount).toBe(1); expect(store.rows[0].domain).toBe("https://deployment-staging.example.test");
    expect((await client.query('SELECT count(*)::int AS count FROM "_prisma_migrations"')).rows[0].count).toBe(2);
    expect((await client.query('SELECT count(*)::int AS count FROM "Order"')).rows[0].count).toBe(0);
    expect((await client.query('SELECT count(*)::int AS count FROM "Product"')).rows[0].count).toBe(0);
    expect((await client.query('SELECT count(*)::int AS count FROM "AdminUser"')).rows[0].count).toBe(0);
    await client.query('UPDATE "StoreSettings" SET "brandName" = $1, "deliveryFeeMinor" = $2 WHERE id = $3', ["Preserved staging store", 575, "store"]);
    await client.query('UPDATE "CommissionRule" SET "amountMinor" = $1', [333]);
    const second = prepare(url);
    expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);
    const preserved = (await client.query('SELECT "brandName", "deliveryFeeMinor" FROM "StoreSettings" WHERE id = $1', ["store"])).rows[0];
    expect(preserved).toEqual({ brandName: "Preserved staging store", deliveryFeeMinor: 575 });
    expect((await client.query('SELECT "amountMinor" FROM "CommissionRule"')).rows).toEqual([{ amountMinor: 333 }]);
  });
  it("leaves a fresh preview database untouched", async () => {
    const { url, client } = await freshDatabase(); const result = prepare(url, "preview");
    expect(result.status).toBe(0);
    expect((await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'")).rows[0].count).toBe(0);
  });
  it("fails without resetting an incompatible existing database or seeding over its records", async () => {
    const { url, client } = await freshDatabase();
    await client.query('CREATE TABLE "User" (sentinel TEXT NOT NULL)');
    await client.query('INSERT INTO "User" (sentinel) VALUES ($1)', ["Keep this record"]);
    const result = prepare(url); expect(result.status).not.toBe(0);
    expect((await client.query('SELECT sentinel FROM "User"')).rows).toEqual([{ sentinel: "Keep this record" }]);
    expect((await client.query("SELECT to_regclass('public.\"StoreSettings\"') AS table_name")).rows[0].table_name).toBeNull();
    expect((await client.query('SELECT count(*)::int AS count FROM "_prisma_migrations"')).rows[0].count).toBe(0);
  });
});
