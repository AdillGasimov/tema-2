# Deployment and operations

The owner has deployed the separate `tema-2-staging` project through Vercel's GitHub integration. See `VERCEL.md` for its automatic database preparation and current verification limits. These instructions also cover a later business production release.

## Required services and configuration

Use Node 24, a managed PostgreSQL 17 database with TLS verification, and a private persistent S3-compatible bucket. Next.js can run on a managed Next.js host or the included Docker image. The runtime must have network access to its database and storage. Do not use ephemeral local filesystem storage in production.

Set private environment variables using the host's secret manager, following `.env.example`. Generate separate cryptographically random secrets of at least 32 bytes for `BETTER_AUTH_SECRET`, `REFERRAL_SECRET`, and `JOB_SECRET`. Set `BETTER_AUTH_URL` to the exact HTTPS public origin; Vercel can alternatively supply its canonical hostname. Never prefix credentials with `NEXT_PUBLIC_`. The ordinary `npm run build` and Docker build do not require a running database. The primary-target Vercel build also runs database preparation and therefore requires its configured database connection. Provide runtime credentials separately; the Docker build-only placeholders are not defaults in the application.

For AWS, prefer a workload role and the SDK's default credential chain. For other S3 providers set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Bucket permissions need only get, put, head and delete objects under `images/`. Do not make the bucket public; the application serves public product/branding images and checks admin access for drafts/expense attachments. Configure TLS and appropriate provider-side backup/versioning. Cross-origin bucket CORS is unnecessary because uploads go through the server.

## Release procedure

1. Back up any existing database and verify its recovery plan. Review migration SQL. Run `npm ci`, `npm run db:generate`, then `npm run db:migrate` from a trusted release job with database access. The runner checks migration SHA-256 hashes and uses advisory locks/transactions. It never resets the database. Investigate a failed or modified migration manually.
2. On the first release run `npm run db:seed` to initialize settings and categories. It preserves existing settings, adds no products or sales, and never overwrites account credentials. Create the production storage bucket explicitly before initialization.
3. Provision the first administrator with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in a private shell and `npm run admin:create`. The password must be 12–128 characters. Do not place the password in command history or commit it. Clear these variables afterwards. Use the private generated local owner account only for local development.
4. Build with `npm run build`, or `docker build -t automotive-store .`. In the managed cloud environment use `docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t automotive-store .` to preserve the session's CA trust. No Docker build has been assumed verified merely because the Next.js build passed.
5. After explicit deployment approval, start the approved release with its private runtime configuration. Use HTTPS, a reverse proxy that overwrites untrusted forwarding headers, body size limits of 9 MB, connection/request timeouts, and a restrictive firewall. The app's IP rate limiting relies on that sanitized forwarding header. Use a connection pool sized for your database; avoid unbounded serverless connections.
6. Open `/login`, set the final store name, HTTPS domain, logo, contact/WhatsApp number, delivery terms and commission policy. Upload actual product photography, configure costs/prices/stock, then publish products. There are no seeded production products, reviews or sales statistics.
7. Schedule authenticated `POST /api/jobs/sync` every minute, with `Authorization: Bearer <JOB_SECRET>`. It releases expired stock reservations, removes expired rate counters, and processes optional Sheets jobs. Do not make the secret part of a URL. Alternatively schedule `npm run jobs:sync` in a trusted worker with the same private environment. Live processes are not restored by a filesystem snapshot.
8. Re-run the acceptance workflow in staging with real storage and contact configuration. Verify the first live order manually. Application tests do not send WhatsApp messages, execute bank transfers or prove external delivery/payment happened.

## Google Sheets (optional)

Create a dedicated spreadsheet and an `Orders` tab, grant the service account editor access, and configure `GOOGLE_SERVICE_ACCOUNT_JSON` plus `GOOGLE_SHEET_ID` securely on the server. Enable Sheets in admin only after configuration. Network access must include `oauth2.googleapis.com` and `sheets.googleapis.com`. The worker uses a distributed lease and assigns stable database-backed row numbers before sending updates, so retries overwrite the same row. Do not insert/delete/reorder rows in the synchronized `Orders` tab; build reporting views in another tab. Deleting a job's database row breaks the durable mapping and must not be part of routine maintenance. No external Google credential is supplied in this workspace; tests verify the outbox with an injected writer, not a live Google spreadsheet.

## Backups, monitoring and recovery

Enable managed PostgreSQL point-in-time recovery and daily encrypted backups. Back up S3 objects/version history separately. Test restoring both to staging; migration records and upload metadata must remain aligned. Never run a reset against business data. Retain financial records and audit logs according to the business's legal policy.

Monitor 5xx responses, database latency/connections, storage errors, failed job attempts, expiry-worker heartbeat and unusually high login failures. Forward redacted error names and request IDs to a managed log sink; do not log passwords, cookies, customer payloads or service-account JSON. Alert when Sheets retries accumulate. Introduce a documented account recovery procedure and add MFA/SSO before a larger multi-admin rollout. A general application build/security test is not an independent security audit.

## Current operational limits

- Whole-order physical returns, not line-item returns, are supported. Payment/refund amounts can be partial. Return and refund are separate operations.
- Default commissions require manual approval, followed by making them payable. Paid reversals are negative adjustments; the next positive payout offsets all open adjustments. Banking and notification delivery through external WhatsApp/SMS/email are not automated.
- Referal corrections on completed/commissioned orders are blocked to preserve history. Disputes can be reviewed and pre-completion attribution corrected with audit logs. A transfer of an already-completed sale to another partner needs an explicit financial correction workflow before production policy permits it.
- Admin order/audit/history lists show bounded recent records (300 orders/audit entries, 200 inventory entries); CSV exports cover the full requested period. Catalog price sorting currently materializes matches; add indexed price summaries before a very large catalog.
- CSV reports and partner-card PDFs are supported; financial report PDFs are not implemented. The privacy page needs the owner's local legal review, retention schedule, and business identity/contact details before launch.
- The optional MinIO Compose profile requires an available official image/registry. Local development uses the loopback-only S3 emulator; it must not run on a public interface or in production.
