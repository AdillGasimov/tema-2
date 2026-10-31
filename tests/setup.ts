import { config } from "dotenv";
config({ path: ".env.test", override: true, quiet: true });
if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) throw new Error("Tests require a dedicated database ending in _test. Run npm run test:prepare.");
