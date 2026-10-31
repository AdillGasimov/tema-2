# Implementation plan

Build a modular monolith for an Azerbaijan automotive shop, preserving financial history and partner privacy.

1. Foundation: Next.js/TypeScript/Tailwind, PostgreSQL/Prisma migrations, Better Auth sessions, admin/partner authorization, settings, validation and rate limits.
2. Storefront: configurable premium home, searchable/filterable catalog, variants/images, persistent cart, referral capture, transactional checkout and WhatsApp handoff.
3. Operations: products/categories, S3 image uploads, inventory ledger, customers, order transitions, payments/refunds, costs and audit history.
4. Referrals: partner accounts, normalized unique codes, expiring attribution, per-partner QR/PNG/SVG and printable PDF cards, bulk export.
5. Commissions: snapshotted fixed rules, paid/completed eligibility, hold/approval/payable stages, reversals/adjustments, exact-allocation payouts.
6. Partner portal: own order projections, earnings, visits, QR, disputes, notifications and payout history.
7. Finance: collected revenue/refunds, historical COGS, nonduplicated expenses, contribution, date ranges, charts and CSV reports.
8. Integrations: durable Google Sheets outbox, retry/upsert, database notifications and reports.
9. Readiness: unit/integration/browser business workflow, authorization/privacy tests, production build, deployment and owner documentation.

## Architecture and acceptance

See `docs/ARCHITECTURE.md` for API boundaries, roles, workflows, and security. Each phase must pass lint, TypeScript, relevant tests, and production build before it is recorded as validated. The final browser workflow covers admin product/image/partner setup → referred checkout → delivery/payment/completion → approval → payout → private partner reporting. No production deployment is authorized.

## Acceptance result

The initial implementation across phases 1–9 is locally validated through the full acceptance workflow. All 18 admin sections render, and the actual browser workflow exercises product/image creation, referred checkout, manual order processing, commission approval and partner payout visibility. Rebranding and product price/archive changes take effect without a rebuild. See `PROGRESS.md` for exact check counts, resolved failures and capability boundaries.

Remaining production work includes real service/contact/catalog configuration and operational/security/legal review. Scope extensions still outstanding: completed-sale attribution transfer accounting, line-item returns, financial PDFs, partner self-service applications, optional external notification providers and MFA. These are not claimed complete. Production deployment still requires explicit approval.
