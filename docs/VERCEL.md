# Vercel staging deployment

The owner imported `AdillGasimov/tema-2`, branch `main`, into their existing Vercel account as `tema-2-staging`, connected Prisma Postgres, and deployed it. The first build succeeded, but runtime logs show missing `StoreSettings`, `Product` and `ProductCategory` tables. PostgreSQL is reachable; schema and initial settings preparation were missing.

## GitHub deployment and account access

The Vercel GitHub integration can build updates pushed to `main` without a Vercel API credential in this workspace. Open the existing project's Deployments page to inspect the latest commit and build status. The agent has not independently accessed the project's configuration, live URL or runtime logs; current remote evidence is the owner's screenshots.

The owner supplied the website URL `https://tema-2-staging.vercel.app/`. This environment's outbound proxy blocks that hostname (CONNECT 403), so an attempted HTTPS check could not determine the application's response. Repair commit `4f5bdba` is pushed to `main`; confirm the latest deployment reaches Ready, then open Visit.

Direct API/CLI inspection would need account authentication. An optional secure `VERCEL_TOKEN` requirement remains in the cloud draft, scoped to `api.vercel.com`; it has no saved binding in the running environment. It is not a prerequisite for GitHub-triggered deployments. Never send tokens in chat or commit them. Cloud draft publication and a Vercel website deployment are separate operations.

## Database preparation in the Vercel build

`vercel.json` runs `npm run build:vercel`: generate Prisma Client, run `scripts/prepare-vercel.ts`, then build Next.js. On Vercel's primary target (`VERCEL=1`, `VERCEL_ENV=production`), preparation applies the reviewed SQL migrations with the existing locked/checksummed runner and initializes missing settings/categories/commission policy. Vercel calls this target "production" even when the project is named `tema-2-staging`.

Preparation uses `DATABASE_URL` and fails the build if migration or initialization fails. It never resets the database, overwrites existing settings/accounts or fabricates products/sales. Initial settings use the configured website origin or the Vercel-provided canonical hostname. Initialization is transactional and serialized; rerunning it preserves edited settings and the existing commission policy.

Preview and development builds skip automatic database changes. For a separately managed release job, set `SKIP_DEPLOY_DB_SETUP=1` and run migrations/initialization in that job instead. Review new migration SQL and preserve backups before later business-data releases. The ordinary `npm run build` and Docker build remain independent of a running database.

Database preparation uses `--skip-storage`: it neither creates nor verifies a bucket. The release also checks for opt-in first-administrator configuration after initializing the database.

## Create the first administrator

There are no default live login details. In **Vercel → tema-2-staging → Settings → Environment Variables**, privately add the following for **Production**:

| Variable | Value |
| --- | --- |
| `ADMIN_EMAIL` | The email address you want to use to sign in. |
| `ADMIN_PASSWORD` | A new private password of 12–128 characters. |

Keep these details in your password manager. Save and redeploy the latest version containing first-admin setup. The build log reports **First administrator created** without printing the credentials. Sign in at `https://tema-2-staging.vercel.app/login` with those chosen details. `BETTER_AUTH_SECRET` remains the separate application authentication setting.

After successful login, remove **both** temporary variables and redeploy. The account and password hash remain in PostgreSQL. Older deployment snapshots may retain their original environment; use the new deployment after removal.

`npm run admin:bootstrap` is called only by primary-target Vercel preparation. It uses a serializable transaction and advisory lock. If an administrator exists, it preserves all accounts/passwords and ignores bootstrap values. Changing those variables does not reset a password. With no administrator, missing both variables skips creation, invalid/incomplete values fail, and an email already belonging to any account is rejected without promotion or modification. Preview builds do not provision administrators. No public signup or bootstrap endpoint was added.

With `SKIP_DEPLOY_DB_SETUP=1`, a trusted release job can run `npm run admin:bootstrap` after migrations/initialization instead. The explicit `admin:create` command remains available for additional administrators. Never put credentials in chat, Git or screenshots.

## Application requirements on Vercel

- Framework: Next.js. `vercel.json` specifies the tested install/build commands and Frankfurt region.
- Use a persistent PostgreSQL database reachable from Vercel and a private S3-compatible image bucket. The local Docker database/emulator is for local development and cannot be used by a remote Vercel function through loopback addresses.
- Configure a direct PostgreSQL `DATABASE_URL`, `BETTER_AUTH_SECRET`, `REFERRAL_SECRET`, `JOB_SECRET`, and S3 settings securely for the staging environment. `BETTER_AUTH_URL`, when set, must be the selected HTTPS origin. Without it, the app uses Vercel's supplied canonical hostname, with only the exact deployment/branch hostnames also accepted for request origins. No wildcard or request-header origin is trusted. The editable store domain must match the intended public origin before referral cards are distributed.
- Generate independent staging secrets and a separate staging administrator. Do not upload the local owner credential file or reuse production customer data for testing.
- Keep build-time database access available for automatic primary-target preparation, or use the explicit release-job option above.
- Check the account's plan before scheduling periodic jobs. The current maintenance endpoint accepts authenticated POST requests; do not configure a Vercel GET cron against it without implementing and testing a compatible handler. No paid cron plan or external scheduler has been provisioned.
- Keep Google Sheets disabled until its service account, spreadsheet and network access have been configured and verified.

After deployment, verify `/api/health`, storefront, owner login, actual image uploads, and the order-to-payout acceptance workflow against staging services. A successful upload/build is not proof those functional checks passed. Deployment protection may restrict access to the generated preview URL.

The staging project has been created and deployed by the owner. A successful hosted repair still needs confirmation from its latest deployment and live storefront; local checks alone do not establish that. Real business launch, paid plan changes and external integration readiness are not implied.
