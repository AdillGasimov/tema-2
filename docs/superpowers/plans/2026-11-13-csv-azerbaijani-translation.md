# Azerbaijani CSV Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Automatically prepare Azerbaijani product presentation during CSV import and provide a reusable translated CSV without changing financial, stock, variant or photo values.

**Architecture:** A pure CSV preparation layer groups existing variants and substitutes validated text while retaining the source cells. A separate authenticated, rate-limited free MyMemory endpoint translates one product at a time outside database transactions. The existing importer receives the exact prepared CSV after the owner reviews its preview.

**Tech Stack:** Existing Next.js, TypeScript, Zod, native fetch, Vitest, PostgreSQL/Prisma and Playwright. No new runtime dependency or database migration.

**Follow-up fix (14 November):** supplier translation can expand beyond160/500characters. Fit title/short text automatically and retain omitted wording in the full description; share its20000-character bound with CSV validation and the editor. Keep fact checks after fitting.

**Spec:** `docs/superpowers/specs/2026-11-13-csv-azerbaijani-translation-design.md`, approved by the owner's “do”.

## Global Constraints

- Names at most 160 characters, short descriptions at most 500, full descriptions at most 20000; existing CSV limit 200 rows / 512 KiB remains.
- Translate presentation only; keep prices, costs, stock, discounts, supplier SKUs, category selections, variant identities and image URLs exact. Keep grouped variants together.
- Use “ətirləndirici”; preserve product facts, model names and numeric specifications. No new benefits or supplier instructions.
- Owner amendment “do it without cost”: use MyMemory’s anonymous free API only, no key/billing/paid fallback. Respect 5 000 characters/day and 500 bytes/segment; pause on quota. Public startup remains independent.
- Provider work is outside PostgreSQL transactions; keep existing draft creation, idempotency, FC codes, photo import and public storefront behavior.
- Work in the existing `work` checkout under AGENTS.md. Preserve unrelated owner drafts. Execute continuously in this session under the owner's implementation instruction.

## Review Focus

- CSV identity cells beginning with spreadsheet formula characters or an apostrophe must survive safe export/reimport without SKU or variant changes (Task 1).
- Different source products translating to the same slug must report a collision, never silently merge (Task 1).
- Provider refusals, truncated responses and invented numeric facts must fail before a prepared CSV can be saved (Task 2).
- A failed second translation must retain the first result; retry and category changes must not request translation of completed products again (Task 3).
- Photo-only CSV and replayed imports must never call the provider or create duplicate inventory (Tasks 3–4).

---

### Task 1: Reversible CSV preparation

**Files:** Modify `src/lib/product-csv.ts`; create `src/lib/product-translation-csv.ts`, `src/lib/product-translation-schema.ts`; test `tests/unit/product-translation-csv.test.ts` and existing CSV tests.

**Interfaces:**
- Shared `ProductTranslationInput` / `ProductTranslationText`: `{ name: string; description: string; shortDescription: string }`, validated with the spec's field limits.
- `createTranslationDraft(csv: string): TranslationDraft` returns a validated source document and stable groups `{ id, input, rowIndexes }` based on the original slug.
- `translatedProductCsv(draft: TranslationDraft, results: Record<string, ProductTranslationText>): string` replaces name/description/short description/slug only, validates completeness and slug uniqueness, and returns a reusable UTF-8 CSV.
- `readProductCsvDocument` exposes validated headers, canonical keys and lossless source records to the preparer. An explicit `furycar_csv_format=1` marker identifies reversibly escaped exports; both formula prefixes and original leading apostrophes round-trip. No marker means legacy behavior remains.

- [x] Write tests asserting `"14,99"`, `"5.00"`, `"7"`, supplier SKU, category, variant and image cells survive Azerbaijani substitution; grouped variants share one translation; missing results and colliding translated slugs fail. Test formula/apostrophe identities, already-Azerbaijani text, BOM/multiline cells and expanded output above 512 KiB.
- [x] Run `npx vitest run tests/unit/product-translation-csv.test.ts`; expected RED for missing preparation behavior.
- [x] Implement the shared schemas, document access and reversible preparation. Reject invalid source CSV before any provider request. Keep source metadata and selected identity columns.
- [x] Run `npm test`; expected all unit tests PASS, including existing legacy/photo parsing and new round trips.
- [x] Commit the tested CSV preparation files only.

### Task 2: Bounded authenticated translator

**Files:** Create `src/lib/product-translation.ts`, `src/app/api/admin/product-translate/route.ts`; test `tests/unit/product-translation.test.ts`, `tests/integration/product-translation.test.ts`; update `.env.example`.

**Interfaces:**
- `translateProductText(input: ProductTranslationInput): Promise<ProductTranslationText>` validates input and calls the fixed free MyMemory endpoint (`autodetect|az`). Sequential UTF-8 word-boundary chunks at most480bytes, 40-second total deadline,64KiB response bound, no key/paid fallback/retry. Fill absent short/full descriptions only from translated source facts.
- POST `/api/admin/product-translate` consumes one text object (64 KiB body maximum), requires trusted JSON Origin plus ADMIN session, rate limits to 60 requests/minute, and returns validated translated text with `Cache-Control: no-store`. Route maxDuration 60 seconds. Photo, price, stock and customer fields are not accepted or sent.
- Provider output must be complete and validated, preserve numeric values with contextual units/signs/dimensions/model codes and use “ətirləndirici”. Quota/service error, timeout, malformed or unfinished output receives a safe Azerbaijani error without provider payloads or secrets.

- [x] Write tests for successful English-to-Azerbaijani output and already-Azerbaijani content; preserve `50 ml` / `AV-198`; require no key and reject free-quota exhaustion, invalid/unknown input, provider errors/invalid envelopes, extra input fields, overlong text, new numeric facts and timeout. Stub only the external HTTP boundary.
- [x] Run `npx vitest run tests/unit/product-translation.test.ts`; expected RED for missing translator.
- [x] Verify current official free-service API/limits and a fictional live sample, then implement the adapter and thin protected route. Remove the earlier optional paid-key placeholder.
- [x] Add real-database route tests for unauthorized/partner/untrusted-origin access, free-quota behavior and rate enforcement; ensure no products or inventory are created by translation requests. Run the named unit/integration cases; expected PASS.
- [x] Commit the tested provider/route/config files only.

### Task 3: Automatic import UI and translated download

**Files:** Modify `src/components/product-csv-import.tsx` and relevant import styles; create focused `tests/e2e/product-translation.spec.ts`; adapt external-provider stubbing in existing CSV browser cases only.

**Interfaces:**
- Product `checkFile()` prepares groups, sequentially calls Task 2's route, applies Task 1's serializer, then passes that exact CSV to existing preview/import endpoints. Never repeat provider calls in `importProducts`.
- Keep completed translations in the current file session; stop at the first failure and allow explicit continuation. File or kind changes clear the session; category changes preserve completed text but invalidate the database preview.
- Display Azerbaijani progress, translated name/short/full description review, safe errors and **“Azərbaycan dilində CSV-ni yüklə”**. Download includes photo links and exact source numeric/identity values. The save action remains unavailable until translation and normal preview succeed.
- Photo-only imports follow their existing path and never call translation.

- [x] Write a browser case uploading two English products with comma prices/photo links, failing the second provider response, and asserting save is blocked, retry reuses the first result, the preview/download are Azerbaijani and the saved draft has exact original financial/stock/photo values.
- [x] Write checks for free-quota exhaustion with original file retained, category-change cache reuse, read-only translated review, explicit administrator-reviewed prepared-file reuse without external calls, and a provider-free photos-only import. Stub the external translation route only in browser UI cases; route security has real coverage in Task 2.
- [x] Run the focused production-browser case; expected RED because automatic translation/download are missing.
- [x] Implement automatic preparation/progress/cache/review/download using the interfaces above. Retain existing import response, photo retry and draft/idempotency code.
- [x] Run focused browser cases and legacy Birmarket/Temu CSV regressions; expected PASS. Commit the UI and corresponding tests only.

### Task 4: Complete verification, setup instructions and review

**Files:** Update `docs/ARCHITECTURE.md`, add `docs/CSV_TRANSLATION_SETUP.az.md`, update `PROGRESS.md`; extend relevant integration coverage for prepared draft import/replay.

**Interfaces:** Use the prepared CSV from Task 1 with the existing `previewProductImport` / `importProducts`; no provider dependency belongs in their transaction.

- [x] Add an integration case creating translated grouped drafts and replaying the exact prepared CSV; assert one inventory/audit effect, exact price/cost/stock/variant identities, and rejection of existing or reserved slug collisions.
- [x] Run that integration case; expected RED until any missing format/import interoperability is corrected. Preserve existing immutable order history.
- [x] Write Azerbaijani free-service usage instructions: no account/key/billing, daily character limit, small batches, external text processing, quota pause/resume, reviewed ready-file reuse and review-before-import.
- [x] Run `npm run lint`, `npm run typecheck`, `npm test`, relevant integration tests, `npm run build` and focused production-browser checks in an isolated test database. Expected all applicable checks PASS; restore test environment, keep prior databases, use no paid service or production orders.
- [x] Perform the fresh whole-branch review required by executing-plans, address material findings with RED→GREEN tests, and record limitations and any remaining owner setup.
- [ ] Commit tested code/docs explicitly, preserve owner drafts and follow the existing authorized publication workflow. Never claim real automatic translation was verified without a working free provider.
