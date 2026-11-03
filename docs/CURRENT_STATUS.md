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

Latest verification passed lint, TypeScript, 52 unit tests, 23 PostgreSQL/S3 integration tests, production build and all 6 Chromium acceptance tests. A real-SDK regression test verifies Blob authentication from trusted Vercel request context without a token environment variable; another verifies safe failure when the provider rejects access. Those transport responses are simulated, not live Blob access. Browser checks include draft/public image access, upload size feedback, and checkout activation immediately after saving WhatsApp. The dependency lockfile is unchanged from the previous clean production audit. Earlier first-admin login and 24-request limited-role production stress validation are recorded in `PROGRESS.md`.

PostgreSQL runs in `tema-2-db-1`; the S3 development emulator uses a retained execution session on port 9000. Private local configuration and generated owner credentials are ignored, mode-restricted files for the development database only. Earlier Docker application-image validation remains historical; that image is not assumed present here. Restart services using the saved startup instructions after each new task. Publication does not preserve processes or establish Docker readiness.

## Hosted limits

The owner deployed `tema-2-staging` through GitHub import and supplied `https://tema-2-staging.vercel.app/`. The previous direct HTTPS check was blocked by outbound policy. This workspace has no Vercel API credential/connector. Native Git uses platform authentication and does not require another token.

The owner confirmed live administrator access. The connection-exhaustion fix is on GitHub; subsequent upload feedback identified missing image-store configuration. The owner then supplied a screenshot of the new **Private** `tema-2-staging-blob` store and confirmed its project connection after being instructed to select Production. The app supports private Vercel Blob as well as existing S3. Images are limited to 4 MiB. This workspace has not directly inspected the store's environment binding or verified a hosted upload.

The owner explicitly authorized publishing the tested photo-upload fix. Native HTTPS Git successfully pushed commit `88467bb1a4f006b00e6eebf20a0f73865ef78ee1` to GitHub `main` without forcing; a separate remote-ref check confirmed the matching SHA. Earlier GitHub authentication failures no longer block that operation. The GitHub-linked Vercel deployment is expected to build this update, but this runtime's outbound policy still blocks direct Vercel status/site inspection and no Vercel API credential/connector is configured. Wait for the latest deployment to become Ready, then verify an actual admin photo upload.

The next owner screenshot shows `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` assigned to Production and Preview. The original provider check incorrectly required an OIDC environment variable even when Vercel supplies identity in trusted request context. The follow-up accepts the store ID and delegates authentication to the official SDK, retaining S3 precedence and private-media authorization. The real-SDK regression reproduces the original missing-configuration error before this correction and passes afterward. Keep the existing store connection; a manual read-write token is not required for this OIDC connection. The latest hosted deployment and actual upload still need verification.

The reported closed-checkout message means the business WhatsApp field is blank. Save the real number (with country code) in **Admin → Tənzimləmələr → WhatsApp nömrəsi**, then refresh checkout; this setting does not need a deployment. Both the client and server guard stay in place. Contact/catalog configuration and the full hosted workflow still need owner verification. Local tests and mocked private-Blob contracts do not establish live provider readiness. Do not send passwords or tokens in chat.
