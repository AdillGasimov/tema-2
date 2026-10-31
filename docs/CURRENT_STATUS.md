# Current handoff

The owner requested that all available setup and publication work be handled automatically.

## Completed

- Source code is committed and pushed to `https://github.com/AdillGasimov/tema-2` on `main`. Private environment and login files are ignored and were excluded from Git.
- The Vercel repair passed lint, TypeScript, 31 unit tests, 18 database/storage integration tests, the full Vercel build against a fresh test database with HTTP 200 storefront smoke check, and four Chromium end-to-end tests.
- Before this follow-up, a real Docker build passed. The resulting `tema-2:staging` image passed a browser smoke test with the existing local owner account, plus database/storage health. The container runs as the non-root Node user. Private `.env` and owner credential files are not embedded in it. That local image has not been rebuilt for the Vercel repair.
- Local restartable containers are `tema-2-app` (port 3000), `tema-2-storage` (port 9000), and `tema-2-db-1` (PostgreSQL). Published host ports remain loopback-only. The owner separately deployed the Vercel project `tema-2-staging` and supplied `https://tema-2-staging.vercel.app/`.
- Existing database and object files were preserved. The business database contains no fabricated sales or products. Local owner credentials remain in the private ignored `.local/owner-credentials.json` file.

## Local container details

The application uses private `.local/container.env` generated from the existing local configuration. Its database hostname is `db` on the `tema-2_default` Docker network; its S3 endpoint is the storage container's network alias. Do not copy this private file to Git or reuse its local credentials in production.

The local S3 emulator uses the supported path-style setting (`--no-vhost-buckets`), mounted installed dependencies read-only, and `.local/objects` for persistent data. It runs under the workspace user's UID 1000 and binds through a loopback-only host port. The S3 emulator remains a development-only service. Do not substitute it for managed production storage.

For these already-created containers, use the local Docker daemon and start `tema-2-db-1`, then `tema-2-storage`, then `tema-2-app` if stopped. Verify application health and the storefront before assuming readiness. If a future machine does not retain the Docker image/containers, use the reproducible source setup in `README.md` and build instructions in `docs/DEPLOYMENT.md`; filesystem snapshots do not establish process or Docker-volume restoration.

## External blockers

The owner created `tema-2-staging` using Vercel's GitHub import, selected Prisma Postgres, and deployed. Runtime screenshots show connected PostgreSQL with missing tables. Repair commit `4f5bdba` is pushed to GitHub `main`: the Vercel build now applies existing migrations and initializes settings on the primary target, preserving existing records; preview builds skip database changes. A direct HTTPS check of the supplied live URL was blocked by the cloud environment's outbound proxy (CONNECT 403), not an application response. The repair must still be confirmed against the latest hosted deployment. See `docs/VERCEL.md`.

GitHub-triggered deployment does not require a Vercel API token in this workspace. The running environment has no Vercel credential, linked CLI project or deployment connector, so direct inspection is unavailable. The previously saved token requirement is optional for that inspection. Remote secrets, the first staging administrator, actual image storage, live contact/catalog configuration and the full hosted workflow remain unverified. Do not provide tokens/passwords in chat.

The cloud tools support saving installation/startup drafts and repository references, but do not expose environment publication. Review/save and Publish are product interface actions. The saved draft is not a published environment or a production website deployment.

The GitHub API request returned Forbidden, so hosted Actions results were not independently read. Native HTTPS Git authentication supports the verified repository push; another GitHub token was not requested just because API access failed.
