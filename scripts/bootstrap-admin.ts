import "dotenv/config";
import { db, transaction } from "../src/lib/db";
import { InitialAdminConfigError, provisionFirstAdmin } from "../src/lib/accounts";

async function main() {
  const result = await transaction(tx => provisionFirstAdmin(tx, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD));
  if (result === "created") {
    console.log("First administrator created. Sign in with the email and password you configured. Remove ADMIN_EMAIL and ADMIN_PASSWORD from the deployment settings and redeploy; the account will be preserved.");
  } else if (result === "exists") {
    console.log("An administrator already exists. Existing accounts and passwords were preserved; bootstrap credentials were not applied.");
  } else {
    console.log("First-admin setup skipped. To create the first administrator, set ADMIN_EMAIL and ADMIN_PASSWORD privately in the deployment settings, then redeploy.");
  }
}
main().catch(error => {
  console.error(error instanceof InitialAdminConfigError ? error.message : "First-admin setup failed. Check database connectivity and migration status. Credentials were not printed.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
