import "dotenv/config";
import { Client } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
// Apply standard Prisma SQL migration files with an advisory lock and checksum validation.
// This avoids the Prisma 6 experimental JS migration engine's pg_catalog `name` decoding defect.
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(873194620)");
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0
  )`);
  const directories = await readdir("prisma/migrations", { withFileTypes: true });
  for (const directory of directories.filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = await readFile(`prisma/migrations/${directory.name}/migration.sql`, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query('SELECT checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = $1', [directory.name]);
    if (existing.rows.length) {
      if (existing.rows.length !== 1 || !existing.rows[0].finished_at || existing.rows[0].rolled_back_at || existing.rows[0].checksum !== checksum) throw new Error(`Migration history mismatch: ${directory.name}. Review manually; no reset performed.`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)', [randomUUID(), checksum, directory.name]);
      await client.query("COMMIT"); console.log(`Applied ${directory.name}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  console.log("Database migrations are current.");
}
main().finally(async () => { await client.end(); });
