# Architecture

## Modules and boundaries

- App Router server components read explicit data projections. Interactive forms call same-origin JSON routes.
- `/api/auth/*`: Better Auth email/password sessions; public registration disabled. Accounts provisioned by an admin or secure CLI.
- `/api/catalog`, `/api/settings/public`: public safe projections, no costs/customer data.
- `/api/referrals`: verifies active codes and sets signed, HttpOnly attribution cookie; direct visits preserve the previous code until expiry.
- `/api/orders`: public validated checkout with idempotency and stock reservations, database persistence before WhatsApp URL generation.
- `/api/admin/*`: role-checked product/category/inventory/order/partner/commission/payout/expense/settings/dispute operations, reports and uploads.
- `/api/partner/*`: session partner ID only, never caller-supplied ownership. Own redacted orders, commission/payout/adjustment history and disputes.
- `/api/cards/*`: authorized owner/admin QR and PDF downloads.
- `/api/jobs/sync`: bearer-authenticated retry worker for a durable Google Sheets outbox.

## Roles and privacy

Better Auth User/Session/Account/Verification tables hold authentication. ADMIN is provisioned only by trusted CLI or the opt-in first-admin release script using private `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The release step is serialized and transactional, preserves an existing administrator, rejects email collisions without promoting users, and never resets passwords. No public signup/bootstrap endpoint exists. PARTNER is linked one-to-one to a partner profile. Every protected handler and layout checks server sessions. Customer checkout is anonymous. Partner projections exclude customer identity, order addresses, phone, purchase cost and store profits. Admin financial APIs are never public.

## Money, orders and inventory

Money is integer minor units (qəpik), bounded at input. Each item snapshots unit selling price, cost, product label, SKU and commission rule. Checkout runs a serializable transaction with retry, validates active products/variants and stock, creates a 30-minute reservation and a unique order/idempotency record. Expired reservations are released transactionally during checkout and admin order operations. Opening WhatsApp changes no payment/completion state. Confirming a live reservation commits the stock; confirming an expired reservation must reacquire availability. Cancellation releases reservations or restores committed stock. Returns restore committed stock once; physical return is whole-order in this first version. Payment/refund ledger is append-only; refunds do not imply goods were physically returned.

## Referrals, commissions and payouts

Codes normalize to uppercase and are unique. HMAC-signed HttpOnly cookie records verified latest referral and expiry. Manual verified code takes priority, explicit empty checkout code clears attribution. Order attribution and commission policy are immutable snapshots. Completion requires delivered goods and full net payment. One commission per order. Approval checks hold, then transitions pending → approved → payable. Payout atomically claims exact payable commission IDs and immutable allocations; paid records remain intact. Cancellation/return/refund reverses unpaid commission; a paid commission gets an immutable negative adjustment. Payout can explicitly settle outstanding adjustments with a partner's next commissions, never silently overwrite history. Admin attribution corrections are permitted only before completion/commission and are audited; financial corrections require the documented dispute workflow.

## Security and integrations

The runtime reuses a process-wide Prisma client in production as well as development. PostgreSQL pools default to one connection per worker and release idle connections promptly. Store-settings memoization is scoped to a render request, sharing reads across metadata/layout/page without retaining private settings between requests or hiding subsequent admin changes. Larger deployments still require provider-level pooling or a replica budget consistent with the database role limit.

Zod schemas reject malformed inputs. Mutations require trusted Origin (except authenticated job endpoint), JSON content type, and persistent rate limits. Better Auth manages password hashing/session cookies and login CSRF protection. Uploads require admin, bounded multipart input (including absent/incorrect Content-Length), a 4 MiB file limit and actual image decoding/reencoding. A private S3-compatible bucket or private Vercel Blob store holds image bytes; both serve through the same authorization-checked media route. A Blob store ID selects the provider; the official SDK authenticates each operation using trusted Vercel request-context OIDC or an existing read-write token. No SVG uploads or public Blob writes. CSV cells are protected from spreadsheet formula injection. Logs do not include secrets or request/customer payloads. Google Sheets is optional; outbox records update the same order row through an idempotent authenticated server integration. It never blocks order creation.

## Production requirements

Managed PostgreSQL, persistent private object storage (S3-compatible or Vercel Blob), TLS domain, cryptographic auth/referral/job secrets, configured WhatsApp number and first admin. Docker Compose supplies local PostgreSQL and object storage only. No payment gateway, automated banking, email, SMS or outbound WhatsApp messaging is implied. Tax accounting, partial merchandise returns and disputes involving already-completed attribution require explicit operational review; contribution is not full accounting net profit.
