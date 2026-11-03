# Automotive commerce platform

A working Azerbaijan automotive storefront and business dashboard: Next.js 16 / React 19 / TypeScript, PostgreSQL 17, Prisma's JavaScript PostgreSQL adapter, Better Auth, Tailwind, S3-compatible images, QR/PDF referral cards, manual WhatsApp ordering, commissions, payouts and private partner accounts.

Customer text is Azerbaijani. Money is integer qəpik and displayed in AZN. Dates display in Asia/Baku. Branding, contacts, catalog and commission policies are database settings. No sample sales, fake reviews, online card payments or automatic bank transfers are seeded or implied.

## Local start

Node 24, npm, Docker with the local daemon running, and Chromium for browser tests are required. Use this existing checkout; cloud tasks are already isolated and do not need a worktree.

```sh
cd /workspace/tema-2
npm ci
npm run db:generate
npm run local:setup
docker compose up -d --wait db
```

In one terminal, start the local S3 development emulator:

```sh
npm run storage:local
```

In another terminal:

```sh
npm run db:migrate
npm run db:seed
npm run local:owner
npm run dev
```

Open the running application's `/` page, `/login` for accounts, `/admin` for administration and `/partner` for a partner's private dashboard. Local development serves port 3000. The ignored `.local/owner-credentials.json` holds the generated local owner credentials; passwords are not printed or committed. Do not use that local account for production. `local:setup`, migrations, initialization and local-owner provisioning preserve existing configuration/accounts when repeated. The database and object files persist locally, but live processes must restart after a new machine/task.

The default store has categories and an editable temporary brand, but no products, phone number or business transactions. Log in, configure the real WhatsApp number, then add and publish products. For an explicit administrator instead of the local helper, securely set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your private shell and run `npm run admin:create`; clear the variables afterwards. See `.env.example`. Never paste credentials into chat or commit `.env`.

## Verification

Tests use the separate `store_test` database and do not modify the development business database. The test fixture changes test settings and adds labeled test products/accounts/transactions. It never resets an existing database. Private test credential files and browser traces are ignored; traces can contain test login values and must not be published publicly.

```sh
npm run test:prepare
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Browser tests default to `/usr/bin/chromium`; set `PLAYWRIGHT_EXECUTABLE_PATH` to another installed Chromium. Production build is required before the end-to-end suite. Playwright starts a separate production-mode test server on port 3100, decodes actual partner QR images, verifies PDF generation and exercises the business workflow. It intercepts WhatsApp handoff instead of sending a message. The included CI workflow installs its own browser.

Prisma 6's experimental migration adapter cannot deserialize PostgreSQL's internal `name` type during deployment. `db:migrate` therefore applies the generated Prisma SQL migration files through a small PostgreSQL runner with advisory locks, transactions and SHA-256 history checks in `_prisma_migrations`. Do not run `prisma migrate reset` or bypass history checks. Prisma runtime/client generation uses the supported Rust-free engine, with no disabled checksum/TLS verification. The pinned build-time overrides fix transitive Prisma configuration advisories; the lockfile is authoritative.

## Documentation

- [Owner's guide in Azerbaijani](docs/OWNER_GUIDE.az.md): managing products, stock, QR cards, orders, commissions and payouts without code.
- [Architecture and security boundaries](docs/ARCHITECTURE.md).
- [Production deployment, backups, worker and current limits](docs/DEPLOYMENT.md).
- [Implementation plan](IMPLEMENTATION_PLAN.md) and [verified progress](PROGRESS.md).
- [Current automation and deployment status](docs/CURRENT_STATUS.md).
- [Vercel staging deployment and database preparation](docs/VERCEL.md).

The owner has imported and deployed `tema-2-staging` through Vercel's GitHub integration. `vercel.json` runs `npm run build:vercel`, which applies migrations and initializes missing settings on the primary Vercel target before building. Preview builds skip database changes. The ordinary local/Docker build does not require a database. See the Vercel guide for the release-job opt-out and remaining service checks.

There is no default live administrator login. To create the first account, privately set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12–128 characters) for the Vercel project's Production environment and redeploy. Sign in with the chosen email/password, remove both temporary variables and redeploy again; the account remains in PostgreSQL. Setup preserves any existing administrator and never resets passwords or promotes another existing user. See [first-admin setup](docs/VERCEL.md#create-the-first-administrator).

Google Sheets requires an optional service account and spreadsheet and remains disabled by default. Image storage in production must be a persistent private S3-compatible bucket. The included local emulator is development-only. Production external services, backups, legal policy and operational review still need the owner's configuration. The staging deployment does not establish readiness for a real business launch.
