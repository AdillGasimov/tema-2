import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { verifyPassword } from "better-auth/crypto";

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
function prepare(url: string, target = "production", variables: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/prepare-vercel.ts"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 20000,
    env: { ...process.env, DATABASE_URL: url, VERCEL: "1", VERCEL_ENV: target,
      BETTER_AUTH_URL: "https://deployment-staging.example.test", SKIP_DEPLOY_DB_SETUP: "0", ADMIN_EMAIL: "", ADMIN_PASSWORD: "",
      // Database initialization must not require, provision or contact object storage.
      S3_ENDPOINT: "http://127.0.0.1:1", S3_ACCESS_KEY_ID: "unused-test", S3_SECRET_ACCESS_KEY: "unused-test", ...variables },
  });
}
function credentials() {
  return { ADMIN_EMAIL: `owner-${randomBytes(5).toString("hex")}@example.test`, ADMIN_PASSWORD: randomBytes(24).toString("base64url") };
}
function bootstrap(url: string, variables: Record<string, string | undefined>) {
  return new Promise<{ status: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/bootstrap-admin.ts"], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url, ...variables }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
    const timer = setTimeout(() => child.kill("SIGTERM"), 20000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", status => { clearTimeout(timer); resolve({ status, output }); });
  });
}
describe("Vercel initialization against real fresh PostgreSQL databases", () => {
  it("creates the missing schema and seeds settings once, preserving edits and financial policy on redeployment", async () => {
    const { url, client } = await freshDatabase();
    const first = prepare(url);
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    const store = await client.query('SELECT "brandName", domain FROM "StoreSettings" WHERE id = $1', ["store"]);
    expect(store.rowCount).toBe(1); expect(store.rows[0].domain).toBe("https://deployment-staging.example.test");
    expect((await client.query('SELECT count(*)::int AS count FROM "_prisma_migrations"')).rows[0].count).toBe(5);
    expect((await client.query('SELECT "legalName", "taxId", "businessAddress", "deliveryTime", "deliveryFreeRegions" FROM "StoreSettings"')).rows).toEqual([{ legalName: "", taxId: "", businessAddress: "", deliveryTime: "", deliveryFreeRegions: "" }]);
    expect((await client.query('SELECT count(*)::int AS count FROM "ProductSlugAlias"')).rows[0].count).toBe(0);
    expect((await client.query("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'ProductImage' AND column_name = 'sourceUrlHash'")).rows).toEqual([{ is_nullable: "YES" }]);
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
    const { url, client } = await freshDatabase(); const result = prepare(url, "preview", credentials());
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
  it("creates a hashed first-admin account and preserves it when bootstrap variables change or are removed", async () => {
    const { url, client } = await freshDatabase(); const chosen = credentials();
    const first = prepare(url, "production", { ...chosen, ADMIN_EMAIL: `  ${chosen.ADMIN_EMAIL.toUpperCase()}  ` });
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    expect((first.stdout + first.stderr).includes(chosen.ADMIN_PASSWORD)).toBe(false);
    expect((first.stdout + first.stderr).includes(chosen.ADMIN_EMAIL)).toBe(false);
    const account = (await client.query('SELECT u.id, u.email, u.role, a.password FROM "User" u JOIN "Account" a ON a."userId" = u.id WHERE a."providerId" = $1', ["credential"])).rows[0];
    expect(account.email).toBe(chosen.ADMIN_EMAIL); expect(account.role).toBe("ADMIN");
    expect(account.password === chosen.ADMIN_PASSWORD).toBe(false);
    expect(await verifyPassword({ hash: account.password, password: chosen.ADMIN_PASSWORD })).toBe(true);
    expect((await client.query('SELECT "userId" FROM "AdminUser"')).rows).toEqual([{ userId: account.id }]);
    for (const variables of [credentials(), { ADMIN_EMAIL: chosen.ADMIN_EMAIL, ADMIN_PASSWORD: "" }, {}]) {
      const repeated = prepare(url, "production", variables);
      expect(repeated.status, `${repeated.stdout}\n${repeated.stderr}`).toBe(0);
      const preserved = (await client.query('SELECT u.id, a.password FROM "User" u JOIN "Account" a ON a."userId" = u.id')).rows;
      expect(preserved.length).toBe(1); expect(preserved[0].id).toBe(account.id);
      expect(preserved[0].password === account.password).toBe(true);
    }
  });
  it("rejects invalid or incomplete initial credentials without creating an account or printing the password", async () => {
    const { url, client } = await freshDatabase(); expect(prepare(url).status).toBe(0);
    const chosen = credentials();
    for (const variables of [
      { ...chosen, ADMIN_PASSWORD: "" }, { ...chosen, ADMIN_EMAIL: "" },
      { ...chosen, ADMIN_EMAIL: "invalid-email" }, { ...chosen, ADMIN_PASSWORD: "short" },
    ]) {
      const attempt = await bootstrap(url, variables);
      expect(attempt.status).not.toBe(0);
      expect(attempt.output.includes("Set both ADMIN_EMAIL")).toBe(true);
      expect(attempt.output.includes(chosen.ADMIN_PASSWORD)).toBe(false);
    }
    for (const table of ["User", "Account", "AdminUser"]) {
      expect((await client.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count).toBe(0);
    }
  });
  it("refuses to promote an existing account with the selected email", async () => {
    const { url, client } = await freshDatabase(); expect(prepare(url).status).toBe(0);
    const chosen = credentials(); const id = randomBytes(16).toString("hex");
    await client.query('INSERT INTO "User" (id, name, email, role, "updatedAt") VALUES ($1, $2, $3, $4, now())', [id, "Existing account", chosen.ADMIN_EMAIL, "PARTNER"]);
    const attempt = await bootstrap(url, chosen);
    expect(attempt.status).not.toBe(0);
    expect(attempt.output.includes("will not change its role or password")).toBe(true);
    expect(attempt.output.includes(chosen.ADMIN_PASSWORD)).toBe(false);
    expect((await client.query('SELECT id, role FROM "User"')).rows).toEqual([{ id, role: "PARTNER" }]);
    expect((await client.query('SELECT count(*)::int AS count FROM "AdminUser"')).rows[0].count).toBe(0);
  });
  it("creates only one first administrator when releases run concurrently", async () => {
    const { url, client } = await freshDatabase(); expect(prepare(url).status).toBe(0);
    const results = await Promise.all([bootstrap(url, credentials()), bootstrap(url, credentials())]);
    for (const result of results) expect(result.status, result.output).toBe(0);
    for (const table of ["User", "Account", "AdminUser"]) {
      expect((await client.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count).toBe(1);
    }
  });
});
