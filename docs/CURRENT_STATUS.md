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

Latest verification passed lint, TypeScript, 50 unit tests, 23 PostgreSQL/S3 integration tests, production build and all 6 Chromium acceptance tests; production dependency audit is clean. Browser checks include draft/public image access, upload size feedback, and checkout activation immediately after saving WhatsApp. Earlier first-admin login and 24-request limited-role production stress validation are recorded in `PROGRESS.md`.

PostgreSQL runs in `tema-2-db-1`; the S3 development emulator uses a retained execution session on port 9000. Private local configuration and generated owner credentials are ignored, mode-restricted files for the development database only. Earlier Docker application-image validation remains historical; that image is not assumed present here. Restart services using the saved startup instructions after each new task. Publication does not preserve processes or establish Docker readiness.

## Hosted limits

The owner deployed `tema-2-staging` through GitHub import and supplied `https://tema-2-staging.vercel.app/`. The previous direct HTTPS check was blocked by outbound policy. This workspace has no Vercel API credential/connector. Native Git uses platform authentication and does not require another token.

The owner confirmed live administrator access. The connection-exhaustion fix is on GitHub; subsequent upload feedback confirms missing image-store configuration. The app now supports a private Vercel Blob store as well as existing S3. Connect/create a **Private** Blob store in Vercel's project Storage panel for Production, keep its supplied token private, and redeploy the latest source. Images are limited to 4 MiB. No external store has been provisioned or verified by this workspace.

The photo-storage changes are tested locally but have not reached GitHub: both native HTTPS Git and the configured CLI credential helper fail authentication. Restore the repository connection, push the local commit without forcing, and deploy that source before expecting Blob support on the hosted site.

The reported closed-checkout message means the business WhatsApp field is blank. Save the real number (with country code) in **Admin → Tənzimləmələr → WhatsApp nömrəsi**, then refresh checkout; this setting does not need a deployment. Both the client and server guard stay in place. Contact/catalog configuration and the full hosted workflow still need owner verification. Local tests and mocked private-Blob contracts do not establish live provider readiness. Do not send passwords or tokens in chat.
