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

Lint, TypeScript, 31 unit tests, 22 PostgreSQL/storage integration tests and all 4 Chromium acceptance tests passed in the new workspace. A full Vercel build created a test administrator; after setup variables were removed and preparation repeated, Chromium logged in and reached product management. Details are recorded in `PROGRESS.md`.

PostgreSQL runs in `tema-2-db-1`; the S3 development emulator uses a retained execution session on port 9000. Private local configuration and generated owner credentials are ignored, mode-restricted files for the development database only. Earlier Docker application-image validation remains historical; that image is not assumed present here. Restart services using the saved startup instructions after each new task. Publication does not preserve processes or establish Docker readiness.

## Hosted limits

The owner deployed `tema-2-staging` through GitHub import and supplied `https://tema-2-staging.vercel.app/`. The previous direct HTTPS check was blocked by outbound policy. This workspace has no Vercel API credential/connector. Native Git uses platform authentication and does not require another token.

Actual live administrator creation/login, remote image storage, contact/catalog configuration and the full hosted business workflow remain unverified until the owner supplies private setup values and the latest deployment is checked. Local tests do not establish hosted readiness. Do not send passwords or tokens in chat.
