# Vercel staging deployment

The owner imported `AdillGasimov/tema-2`, branch `main`, into their existing Vercel account as `tema-2-staging`, connected Prisma Postgres, and deployed it. The first build succeeded, but runtime logs show missing `StoreSettings`, `Product` and `ProductCategory` tables. PostgreSQL is reachable; schema and initial settings preparation were missing.

## GitHub deployment and account access

The Vercel GitHub integration can build updates pushed to `main` without a Vercel API credential in this workspace. Open the existing project's Deployments page to inspect the latest commit and build status. The current runtime can also read GitHub's Vercel commit status and the live site's public HTTP responses. Project configuration, authenticated administrator actions and private runtime logs still require the owner's account.

The owner supplied the website URL `https://tema-2-staging.vercel.app/`. This environment's outbound proxy blocks that hostname (CONNECT 403), so an attempted HTTPS check could not determine the application's response. Repair commit `4f5bdba` is pushed to `main`; confirm the latest deployment reaches Ready, then open Visit.

Direct API/CLI inspection would need account authentication, which is not configured in this task. It is not a prerequisite for GitHub-triggered deployments. Never send tokens in chat or commit them. Cloud draft publication and a Vercel website deployment are separate operations.

## Database preparation in the Vercel build

`vercel.json` runs `npm run build:vercel`: generate Prisma Client, run `scripts/prepare-vercel.ts`, then build Next.js. On Vercel's primary target (`VERCEL=1`, `VERCEL_ENV=production`), preparation applies the reviewed SQL migrations with the existing locked/checksummed runner and initializes missing settings/categories/commission policy. Vercel calls this target "production" even when the project is named `tema-2-staging`.

Preparation uses `DATABASE_URL` and fails the build if migration or initialization fails. It never resets the database, overwrites existing settings/accounts or fabricates products/sales. Initial settings use the configured website origin or the Vercel-provided canonical hostname. Initialization is transactional and serialized; rerunning it preserves edited settings and the existing commission policy.

Preview and development builds skip automatic database changes. For a separately managed release job, set `SKIP_DEPLOY_DB_SETUP=1` and run migrations/initialization in that job instead. Review new migration SQL and preserve backups before later business-data releases. The ordinary `npm run build` and Docker build remain independent of a running database.

Database preparation uses `--skip-storage`: it neither creates nor verifies a bucket. The release also checks for opt-in first-administrator configuration after initializing the database.

The owner-approved catalog presentation release additionally runs `scripts/apply-catalog-presentation.ts` for `catalog/curation/2026-11-06.json`. It targets only the 18 captured existing product IDs, checks their names/categories/gallery order before changes, privately uploads four checksum-verified edited covers and commits only presentation metadata with before/after audits. No inventory or financial fields are part of the plan. A hash-bound receipt makes subsequent builds skip it; other installations without these IDs skip without creating products. Changed captured data stops the batch for review. This step uses the configured private storage identity in the trusted build environment. Preview targets and `SKIP_DEPLOY_DB_SETUP=1` retain their existing skip behavior. Generated cover source keys are kept in the audit and original objects are never deleted.

## Database connection limits

Runtime workers reuse one Prisma client, including production route bundles. Their PostgreSQL pool defaults to **one connection per worker**, releases idle connections after one second, and queues parallel queries within that budget. `DATABASE_POOL_MAX` can explicitly set a budget of 1–10; increase it only after accounting for the provider's total role limit and the number of workers/deployments. The PostgreSQL URL and TLS verification are preserved.

Store settings reads are memoized only within one server-render request, so metadata, layouts and the page share the read. New requests still see administrator edits without a rebuild or persistent-cache invalidation.

The reported `Too many database connections opened` / `too many connections for role "prisma_migration"` error means the configured database role exhausted its total connection budget. The separate SSL-mode warning is not that error. A per-worker pool limit reduces connection use; it does not replace provider-level pooling or a total replica budget for larger deployments. Use the provider's documented application connection/pooling setup for those deployments, and a compatible trusted release connection/job for migrations with session advisory locks. Do not raise role limits, change credentials or weaken TLS merely to hide an application error.

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
- Use a persistent PostgreSQL database reachable from Vercel and either a private Vercel Blob store or a private S3-compatible image bucket. The local Docker database/emulator is for local development and cannot be used by a remote Vercel function through loopback addresses.
- Configure a direct PostgreSQL `DATABASE_URL`, `BETTER_AUTH_SECRET`, `JOB_SECRET`, and private image storage securely for the staging environment. `REFERRAL_SECRET` is optional: when absent, a separate referral-signing key is derived from the configured auth secret. Existing independent referral secrets remain supported. `BETTER_AUTH_URL`, when set, must be the selected HTTPS origin. Without it, the app uses Vercel's supplied canonical hostname, with only the exact deployment/branch hostnames also accepted for request origins. No wildcard or request-header origin is trusted. The editable store domain must match the intended public origin before referral cards are distributed.
- Generate independent staging secrets and a separate staging administrator. Do not upload the local owner credential file or reuse production customer data for testing.
- Keep build-time database access available for automatic primary-target preparation, or use the explicit release-job option above.
- Check the account's plan before scheduling periodic jobs. The current maintenance endpoint accepts authenticated POST requests; do not configure a Vercel GET cron against it without implementing and testing a compatible handler. No paid cron plan or external scheduler has been provisioned.
- Keep Google Sheets disabled until its service account, spreadsheet and network access have been configured and verified.

After deployment, verify `/api/health`, storefront, owner login, actual image uploads, and the order-to-payout acceptance workflow against staging services. A successful upload/build is not proof those functional checks passed. Deployment protection may restrict access to the generated preview URL.

## Connect private image storage

PostgreSQL stores product records; image bytes need their own persistent storage. The app reports `Şəkil yaddaşı konfiqurasiya edilməyib.` when neither usable storage configuration is present.

For the Vercel-native option, open the project's **Storage → Blob**, create or connect a **Private** store, and connect it to this project's **Production** environment. Current connections can supply `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` without a read-write token. The official SDK resolves OIDC authentication from Vercel's trusted request context, with `VERCEL_OIDC_TOKEN` as an environment fallback. The application selects Blob when the store ID is present and lets the SDK authenticate each operation; it does not require the request-scoped identity to be duplicated in environment variables. `BLOB_WEBHOOK_PUBLIC_KEY` is not an access credential. Existing `BLOB_READ_WRITE_TOKEN` configurations remain supported. Redeploy the latest application after connecting, keep credentials private, and verify an actual image upload: a store declaration alone is not proof of successful access.

The adapter writes only private objects with immutable UUID paths, normalizes images to WebP, and serves bytes through the existing authorization-checked `/api/media` route. Direct private-store URLs/tokens are not sent to browsers. Expense attachments and draft product images still require administrator access.

Existing S3 setups continue to use `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT`, and either the normal AWS credential chain or private `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. A configured `S3_BUCKET` takes precedence over Blob. Select one provider for the image namespace; switching providers without copying existing objects would leave old image references unavailable. No bucket/store is created by the build.

Uploads accept JPG, PNG or WebP up to **4 MiB** each, with bounded multipart overhead below Vercel's function request ceiling. The client rejects larger files before sending them and handles non-JSON 413 responses. The server enforces the body bound even when `Content-Length` is absent or incorrect, then decodes/reencodes the actual image. The `/api/health` storage check supports either provider.

## Enable checkout

In **Admin → Tənzimləmələr → WhatsApp nömrəsi**, enter the real business number with country code, save all settings, and refresh checkout. A blank number intentionally closes order acceptance in both the UI and server. Saving it takes effect on new requests without a rebuild. Checkout records an unpaid order and opens WhatsApp for manual confirmation; opening WhatsApp does not mark an order paid or completed.

The staging project has been created and deployed by the owner. A successful hosted repair still needs confirmation from its latest deployment and live storefront; local checks alone do not establish that. Real business launch, paid plan changes and external integration readiness are not implied.
