# Progress

## Repository inspection

- Starting repository is empty, with an unborn local branch. No existing application or business data to preserve.
- Node 24, npm 11, Python 3.12, and Docker are available. No database/storage credentials are supplied.
- Remote Git reads work via the platform proxy with command sandbox network permission.

## Implemented and validated locally — 2026-10-31

| Phase | Delivered capabilities | Evidence |
| --- | --- | --- |
| 1 — Foundation | Strict TypeScript, Next.js, Tailwind, relational PostgreSQL schema/migrations, Better Auth, server roles, settings and private local account provisioning | Production build, lint/type checks, browser login and access-control checks |
| 2 — Storefront | Azerbaijani responsive home, categories, catalog/search/price filters/sorting/pagination, product gallery/variants, cart, optional referral, database-first WhatsApp checkout | Browser product-to-order workflow, mobile/tablet/desktop overflow checks |
| 3 — Admin | Product creation/edit/duplicate/archive/bulk status, private costs and unit margins, image decoding/S3 uploads, categories, inventory ledger, orders/payments/refunds/costs/customer notes | All 18 management pages render; browser creates/uploads/publishes and changes price/archive; transaction tests |
| 4 — Referrals | Partner accounts (email optional), unique normalized codes, signed 30-day-configurable attribution, individual PNG/SVG QR and printable individual/bulk PDF cards | Browser decodes actual QR into the partner URL, downloads actual PDF and carries attribution through checkout |
| 5 — Commission | Snapshotted fixed rules, completed/paid eligibility, manual approval/holding period/payable state, unique accrual, reversals, immutable paid adjustments and exact-allocation manual payouts | Real database lifecycle, duplicate/oversell/concurrent-write checks, negative adjustment settlement; full browser payout |
| 6 — Partner | Own orders/earnings/payouts/adjustments/visits, QR downloads, disputes, notifications, password changes | Browser partner login including code-only login, privacy/ownership checks and payout visibility |
| 7 — Finance | Cash less refunds, fulfilled historical COGS, commission expenses, nonduplicated order/general costs, contribution, partner/product performance and daily/weekly/monthly charts | Exact reconciliation test; browser checks product revenue/cost; date filters in Baku timezone |
| 8 — Integrations | Database notifications, durable Sheets outbox, stable row mappings, lease/retry/version safety and CSV exports | Injected-writer outbox integration test and authorized CSV download; live Google is unconfigured |
| 9 — Readiness preparation | CI, standalone output, Dockerfile, deployment/backups/security and Azerbaijani operating guide | Standalone browser suite, dependency audit and documented setup repeatability; no production deployment |

## Final verification

- `npm run lint`: passed without warnings/errors.
- `npm run typecheck`: passed.
- `npm test`: **17 passed**.
- `npm run test:integration`: **15 passed** against a separate PostgreSQL `store_test` database and local S3 emulator. No business database reset.
- `npm run build`: passed; standalone bundle includes Prisma's WebAssembly compiler. Sitemap and robots metadata update dynamically.
- `npm run test:e2e`: **4 passed** in Chromium against the production-mode standalone server: complete admin/product/image/partner/customer/referral/WhatsApp/order/payment/commission/payout workflow; authorization/ownership/CSRF; all management pages plus rebranding/edit/archive without rebuild; 390/768/1440 px layouts.
- `npm audit --omit=dev`: **0 known vulnerabilities** at verification time. Build-time Prisma overrides are pinned in the lockfile.
- Migrations, settings initialization, local owner provisioning and local configuration preservation were repeated successfully. The exact saved `npm ci --strict-ssl=true` / generation / local-setup script passed, preserving the existing `.env`.

## Resolved setup/implementation failures

- Prisma's native binary host was policy-blocked. Used its supported JavaScript engine and PostgreSQL adapter instead; no checksum or TLS verification was disabled.
- Prisma 6's experimental migration engine could not decode PostgreSQL's `name` catalog type. Generated standard Prisma SQL migrations, applied with a small locked/checksummed/transactional PostgreSQL runner and verified repeatability.
- Official MinIO image pulls were unavailable. Local development uses a loopback-only S3 emulator; production uses configured private S3-compatible storage through the AWS SDK.
- Browser testing exposed different Node/Chromium Azerbaijani ICU output. Deterministic minor-unit money and Baku date formatting resolved hydration errors.
- Standalone tracing omitted Prisma's WASM compiler; explicit tracing now includes it and the standalone workflow is tested.
- Concurrent database writes exposed raw adapter serialization errors in addition to Prisma P2034. The transaction wrapper now retries both forms, with a real concurrent-sufficient-stock test.

## Current runtime and saved configuration

- Development business database has editable initial categories/settings and a generated local-only owner account, with no fabricated products/orders/partners/sales. Test fixtures are isolated in `store_test`.
- Local owner credentials are stored in ignored `.local/owner-credentials.json` with private file permissions; they were not printed or committed.
- Reusable `install_script` and `start_skill` were saved successfully in the cloud environment draft. Review/save and publish of the cloud snapshot remain user actions; this is separate from production website deployment.
- The standalone local store is running on port 3000. Its `/api/health`, storefront, generated owner login and zero-revenue admin dashboard passed a final Chromium smoke check. Actual business counts are 0 products, 0 orders, 0 partners and 1 local administrator.

## Limits / external setup still required

- Production domain, real WhatsApp/contact details, actual product photography/catalog, managed database, persistent private bucket, secrets, backups and legal/operational policy must be configured before launch.
- Real Google Sheets connectivity is not tested because no Google credentials/spreadsheet are supplied. The outbox is tested with an injected writer; it stays disabled by default.
- Whole-order physical returns are supported; line-item physical returns are not. Partial payment/refund ledger entries are supported.
- Completed/commissioned attribution transfers are intentionally blocked. Pre-completion attribution corrections and dispute review are audited. A completed-sale partner-transfer ledger needs a separate explicit financial-correction implementation.
- Financial reports export CSV, not PDF. Partner referral cards export PDF with trim/bleed.
- No external SMS/email/WhatsApp notifications, automatic bank payments, payment gateway, self-service partner application form, or MFA/SSO are claimed implemented.
- The Docker image `tema-2:staging` now builds successfully. Its actual container passed application/storage/database health, storefront rendering, owner login and a zero-transaction dashboard check. It runs as UID 1000 and excludes `.env` and local owner credentials from the image. Hosted CI results have not been verified.
- Local runtime/processes do not prove a fresh published cloud task restores successfully. Production deployment, external integration validation, load/security audit and restore drills have not been performed.

## Follow-up automation requested by the owner

- Committed all 112 reviewed source/configuration files and pushed the application to `AdillGasimov/tema-2`, branch `main`. Verified the remote commit matches the local commit. Credentials, local private files, dependency/build folders and browser traces are excluded.
- Restored the local app and S3 development emulator in restartable containers (`tema-2-app`, `tema-2-storage`) alongside the existing healthy `tema-2-db-1` database container. This avoids relying on an interactive terminal staying open. Stored objects and existing database data were preserved.
- Container hostname routing requires S3rver's supported `--no-vhost-buckets` option because the application uses path-style S3 requests. Signatures and TLS verification were not disabled.
- The local application still has zero products/orders/partners and one local administrator. Real store contact, catalog and payments were not invented.
- Hosting credential variables and CLI configuration are absent, runtime secret bindings and outbound identity connections are empty, and no deployment connector is available. A public staging deployment needs a hosting account/server connection. The GitHub API request returned Forbidden, while native Git read/push operations work; no duplicate GitHub token was requested.
- Cloud configuration tools can save drafts but expose no Publish operation. Environment publication must be performed through the owner's interface. Saving the draft is not publication or a website deployment.
- The owner selected their Vercel account for staging. Added `vercel.json`, a Vercel handoff guide and a secure `VERCEL_TOKEN` draft requirement; the save automatically added `api.vercel.com` to the draft's allowed secret destinations. The owner subsequently used Vercel's GitHub import to create and deploy `tema-2-staging`, avoiding the need for a workspace API token.

## Vercel missing-table repair — 2026-10-31

- The owner's runtime-log screenshot shows PostgreSQL queries reaching the configured database but failing because `StoreSettings`, `ProductCategory` and `Product` are absent. The first hosted build did not apply migrations or initialize settings.
- `vercel.json` now selects `build:vercel`, which generates Prisma Client, applies the existing checksummed/locked SQL migrations, initializes missing store settings/categories/policy, and then builds Next.js. This runs only on Vercel's primary target; previews skip database changes. `SKIP_DEPLOY_DB_SETUP=1` supports a separately managed release job. Ordinary local/Docker builds remain independent of a running database.
- Initialization uses a transaction and advisory lock, preserves edited settings and commission policy on repeated deployment, and skips object storage in the Vercel build. It does not reset any database, provision an administrator or create fake products/orders.
- Store/auth origins can use Vercel's canonical domain and exact deployment/branch hostnames when no explicit `BETTER_AUTH_URL` is configured. No wildcard or request-header trust was added. Existing authorization and mutation guards remain enforced.
- Validation: lint and TypeScript passed; **31 unit tests**, **18 PostgreSQL/storage integration tests**, and **4 Chromium end-to-end tests** passed. New integration checks cover fresh initialization, repeat-deployment preservation, preview isolation and failure against incompatible existing schema without resetting its sentinel record.
- A full `npm run build:vercel` rehearsal against a new isolated test database passed both migrations, initialization, Next.js compilation and a production-mode storefront request returning HTTP 200. The seeded website domain matched the Vercel-provided canonical hostname. Local test databases were used; the business database was not reset.
- Repair commit `4f5bdba` was pushed to GitHub `main`. The owner supplied `https://tema-2-staging.vercel.app/`; a direct HTTPS check was blocked by this environment's outbound proxy (CONNECT 403), so it did not produce an application response. The repaired hosted deployment is still unverified, and this workspace has no Vercel API access. The first staging administrator, remote secrets, actual image storage and the full hosted workflow also remain unverified. The existing local Docker image was validated before this follow-up; it has not been rebuilt for this change.

## Reconnected environment and first-administrator setup — 2026-11-03

- The newer published configuration started a fresh workspace at the GitHub `main` revision. Reapplied install/start instructions to its new draft while preserving the published repository/ref, name, credential settings and package-manager preset. Added only `api.vercel.com` and `tema-2-staging.vercel.app` as custom destinations. No conflicting edits were found and no credential values were saved. Draft persistence was read back successfully; publication remains a product-interface action.
- The saved installation sequence creates local configuration before Prisma generation. A fresh-workspace attempt exposed a missing-environment fallback to a policy-blocked native engine. Correcting the order restored the supported JavaScript engine, and the full saved script passed while preserving `.env`. TLS, signatures and checksum verification remain enabled.
- Restored the interrupted first-admin implementation and revalidated it in this fresh checkout. Private `ADMIN_EMAIL` / `ADMIN_PASSWORD` values create the first administrator during primary-target Vercel preparation. Existing password hashing is used. A serializable transaction/advisory lock prevents concurrent duplicates; existing administrators/passwords are preserved, collisions never promote users, and no public signup endpoint exists. Preview builds skip setup.
- Removing both temporary variables after login preserves the stored account. The owner chooses live values securely in Vercel; no default live login was fabricated or disclosed. `BETTER_AUTH_SECRET` remains the separate application secret, which the owner configured to resolve the earlier admin error.
- Fresh verification: lint and TypeScript, **31 unit tests** and **22 database/storage integration tests** passed. A full `build:vercel` rehearsal created an administrator in a new isolated test database; after both setup variables were removed and preparation repeated, Chromium logged in and reached product management. Test databases are separate from the development business database; no business database reset was performed.
- The complete **4-test Chromium acceptance suite** passed again: product/image/partner setup through referral checkout, order completion and payout; authorization/CSRF/privacy; all management pages and live rebranding; responsive layouts.

## Storefront connection exhaustion — 2026-11-03

- The owner confirmed live administrator access, then reported the public storefront failing. The supplied Vercel log identifies `Too many database connections opened` for role `prisma_migration`. Its SSL-mode warning is a separate warning; TLS configuration was not weakened.
- Reproduced the failure with a generated local PostgreSQL role limited to two connections: the previous default pool fulfilled 2 of 12 parallel queries and rejected 10. Runtime pools now default to one connection per worker, release idle connections after one second, and support a validated optional `DATABASE_POOL_MAX` budget. Production route bundles reuse the same process-wide Prisma client.
- Settings ORM reads now use React request-scoped memoization across metadata/layout/page. Public projections remain explicit, and later requests see saved administrator changes without a persistent cache or rebuild.
- Validation: lint, TypeScript, **39 unit tests**, **23 PostgreSQL/storage integration tests**, production build and **4 Chromium acceptance tests** passed. The browser suite includes immediate rebranding after a settings save, plus the complete product/order/payment/payout workflow.
- Production-mode HTTP stress rehearsal against a fresh isolated database and a read-only role capped at two connections: **24 concurrent storefront/catalog/login/API requests all returned HTTP 200**, with **one** open application connection across route bundles. No business database or credentials were changed.
- Hosted resolution still needs the latest GitHub-triggered Vercel deployment to complete. Per-worker limits do not replace provider-level pooling or a total replica budget at higher scale; this workspace cannot directly inspect Vercel account configuration or the live site's current response under its enforced outbound policy.

## Private photo storage and checkout setup — 2026-11-03

- The owner supplied `Şəkil yaddaşı konfiqurasiya edilməyib.` for uploads and `Sifariş qəbulu hələ aktiv deyil` for checkout. The first means no supported image-store configuration is available; the second is the intentional checkout guard when the business WhatsApp field is blank. The owner can save the real number in admin settings and refresh checkout without a redeployment. No contact number was fabricated.
- Added the official Vercel Blob SDK as an optional private backend. A connected private store's token or store-scoped OIDC binding is used through the SDK. An existing S3 bucket retains precedence; its credential chain remains supported. Both providers retain immutable UUID WebP keys and the existing media-route authorization checks. No public Blob writes, client-side tokens, public signup or database schema changes were introduced.
- Corrected uploads for hosted request limits: 4 MiB per file with bounded multipart overhead, validation before sending, a safe message for non-JSON HTTP 413 responses, and server body counting even without a trustworthy Content-Length. Actual image decoding/reencoding and the 12-image product limit remain enforced.
- Validation: lint, TypeScript, production build, **50 unit tests**, **23 PostgreSQL/S3 integration tests**, and **6 Chromium browser tests** passed. New browser checks verify draft images are denied to guests and available to the owner, published images become public through the proxy, oversized input is blocked before sending, platform 413 text is handled, and saving WhatsApp enables checkout on refresh. One test selector initially also matched Next's hidden route announcer; narrowing it to the image editor resolved the test ambiguity, and the complete suite passed.
- Private Blob adapter operations were checked with SDK mocks, including private-only writes/reads and safe provider errors; real local S3 uploads/readback and the complete order-to-payout browser workflow passed. Live Blob access remains unverified until the owner connects a private store in Vercel Production settings and redeploys. The build does not create a store or credentials.
- Production dependency audit reports **0 known vulnerabilities**. The SDK's transitive `@vercel/cli-config` validator is overridden to patched Zod 4.6.7; lockfile integrity and TLS verification remain enabled.
- Publishing is currently blocked by GitHub authentication: native HTTPS Git requests a username, and the configured GitHub CLI credential helper is rejected as an invalid username/token. The running environment reports no ready outbound identity binding. The tested photo-storage changes remain local until repository authentication is restored; no hosted deployment or external storage connection is claimed.
