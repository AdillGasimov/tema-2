import "dotenv/config";
import { readFile } from "node:fs/promises";
import { applyCatalogReview, inspectCatalogReview } from "../src/lib/catalog-review-release";
import { db } from "../src/lib/db";
async function main() {
  try {
    const plan: unknown = JSON.parse(await readFile("catalog/curation/2026-11-07-review.json", "utf8"));
    const result = process.argv.includes("--check") ? await inspectCatalogReview(plan) : (await applyCatalogReview(plan)).reason;
    console.log(`Owner catalog review: ${result}.`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Owner catalog review failed."); process.exitCode = 1; });
