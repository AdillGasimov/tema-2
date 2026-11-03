# Current handoff — 2026-11-03

The owner requested a working administrator login and restoration of environment changes onto the newer published configuration.

## Environment draft

The new workspace is connected. The saved draft preserves the published repository selection (`main`), name, credential settings and package-manager preset. It restores installation/startup instructions and adds only `api.vercel.com` and `tema-2-staging.vercel.app` as custom destinations. Instructions contain no credential values.

The install script locates the existing application checkout, installs frozen dependencies, generates private local configuration and then generates Prisma Client. The complete script passed in the fresh workspace and preserved `.env`. Creating configuration first avoids Prisma falling back to an unnecessary native engine download; TLS and checksum verification remain enabled.

Saving a draft does not apply or publish it. Review/save and Publish remain actions in the ChatGPT interface. Current runtime policy is separate from saved configuration.

## First live administrator

The owner configured `BETTER_AUTH_SECRET` in Vercel and reported that login opens. There is no default live email/password. Primary-target Vercel preparation now supports first-admin creation using private `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12–128 characters). Set both in Vercel Production settings and redeploy the version with this feature. Sign in with those chosen details, remove both temporary variables and redeploy again; the stored account/password hash remains.

Existing administrators/passwords are preserved. Setup is transactional and serialized, rejects incomplete credentials and existing-email collisions without promotion, and has no public signup endpoint. Preview builds skip setup. See `VERCEL.md` and `OWNER_GUIDE.az.md`.

## Verification and local runtime

Latest connection-limit verification passed lint, TypeScript, 39 unit tests, 23 PostgreSQL/storage integration tests, production build and all 4 Chromium acceptance tests. A production server using a database role limited to two connections handled 24 concurrent storefront/catalog/login/API requests with HTTP 200 and only one application connection. The browser suite also verifies fresh storefront branding immediately after an admin save. Earlier first-admin deployment/login validation is recorded in `PROGRESS.md`.

PostgreSQL runs in `tema-2-db-1`; the S3 development emulator uses a retained execution session on port 9000. Private local configuration and generated owner credentials are ignored, mode-restricted files for the development database only. Earlier Docker application-image validation remains historical; that image is not assumed present here. Restart services using the saved startup instructions after each new task. Publication does not preserve processes or establish Docker readiness.

## Hosted limits

The owner deployed `tema-2-staging` through GitHub import and supplied `https://tema-2-staging.vercel.app/`. The previous direct HTTPS check was blocked by outbound policy. This workspace has no Vercel API credential/connector. Native Git uses platform authentication and does not require another token.

The owner has confirmed that the live administrator panel works. The subsequent storefront failure was diagnosed from Vercel logs as database role connection exhaustion. Runtime workers now share a small Prisma pool and settings reads are memoized per request; the latest hosted deployment still needs confirmation. Remote image storage, contact/catalog configuration and the full hosted workflow remain unverified here. Local tests do not establish hosted readiness. Do not send passwords or tokens in chat.
