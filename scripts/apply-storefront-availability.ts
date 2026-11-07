import "dotenv/config";
import { readFile } from "node:fs/promises";
import { applyStorefrontAvailability, inspectStorefrontAvailability } from "../src/lib/storefront-availability-release";
import { db } from "../src/lib/db";
async function main() {
  try {
    const plan: unknown = JSON.parse(await readFile("catalog/curation/2026-11-08-delivery-stock.json", "utf8"));
    const result = process.argv.includes("--check") ? await inspectStorefrontAvailability(plan) : (await applyStorefrontAvailability(plan)).reason;
    console.log(`Owner delivery and stock confirmation: ${result}.`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Owner delivery and stock confirmation failed."); process.exitCode = 1; });
