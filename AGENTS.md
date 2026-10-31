# Project conventions

- Modular Next.js application, TypeScript strict mode, PostgreSQL through Prisma.
- Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless requested.
- Read `IMPLEMENTATION_PLAN.md`, `PROGRESS.md`, and `docs/ARCHITECTURE.md` before changes.
- Customer-facing text is Azerbaijani; money is integer qəpik, displayed as AZN. Store timestamps in UTC, display Asia/Baku.
- Read brand, contact, catalog, and commission rules from the database. Seed values are configuration defaults, never production sales or reviews.
- Validate every request with Zod. Authenticate and authorize on the server. Public/partner responses use explicit safe projections.
- Financial/inventory mutations are transactional, idempotent, and audited. Never edit historical item prices or erase payouts.
- Use database migrations. Never reset or destructively migrate a business database without explicit approval.
- Keep secrets in ignored environment files. No public demo logins, seeded business transactions, or hardcoded credentials.
- Use `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`, and `npm run test:e2e` for relevant changes. Document what actually ran.
- Update progress with limitations. Do not deploy or push without authorization.
