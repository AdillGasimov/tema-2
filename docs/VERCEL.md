# Vercel staging deployment

The owner selected their existing Vercel account for staging. Source is already on GitHub (`AdillGasimov/tema-2`, branch `main`). No Vercel deployment has been created yet.

## Current prerequisite

The running environment has no Vercel credential or linked Vercel project. A secure `VERCEL_TOKEN` requirement has been added to the cloud configuration draft, scoped to `api.vercel.com`. Enter a deployment token through environment settings and save the configuration; never send it in chat or commit it. Adding a requirement does not supply its value, apply the network change or publish the environment.

Once the binding is ready, the agent can verify account access and inspect a matching project before creating a staging project. Use the intended account/team and avoid paid plan changes. Existing configured services should be reused after their metadata and connectivity are checked; an unset variable alone is not evidence that another credential is required.

## Application requirements on Vercel

- Framework: Next.js. `vercel.json` specifies the tested install/build commands and Frankfurt region.
- Use a persistent PostgreSQL database reachable from Vercel and a private S3-compatible image bucket. The local Docker database/emulator is for local development and cannot be used by a remote Vercel function through loopback addresses.
- Configure `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `REFERRAL_SECRET`, `JOB_SECRET`, and S3 settings securely for the staging environment. `BETTER_AUTH_URL` must match the selected staging HTTPS origin. The editable store domain must match it before referral cards are distributed.
- Generate independent staging secrets and a separate staging administrator. Do not upload the local owner credential file or reuse production customer data for testing.
- Apply the reviewed migrations and initialize settings in a trusted job with staging database access. The Next.js build intentionally does not connect to or migrate a business database.
- Check the account's plan before scheduling periodic jobs. The current maintenance endpoint accepts authenticated POST requests; do not configure a Vercel GET cron against it without implementing and testing a compatible handler. No paid cron plan or external scheduler has been provisioned.
- Keep Google Sheets disabled until its service account, spreadsheet and network access have been configured and verified.

After deployment, verify `/api/health`, storefront, owner login, actual image uploads, and the order-to-payout acceptance workflow against staging services. A successful upload/build is not proof those functional checks passed. Deployment protection may restrict access to the generated preview URL.

The owner must authenticate their Vercel account or supply its secure deployment binding; the agent cannot invent that authentication or complete account signup/billing on their behalf. No production launch is implied by preparing this staging configuration.
