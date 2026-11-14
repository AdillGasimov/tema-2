**Automatic Azerbaijani translation for CSV product imports**

Date: 13 November 2026; amended 14 November. Status: owner approved implementation with “do”, then required “do it without cost”. The free-service design below supersedes the paid provider recommendation.

**Intent and scope**

The owner wants newly imported products to have Azerbaijani presentation text automatically. They selected translation during the website's CSV import, with a downloadable Azerbaijani CSV, and initially requested API setup, then explicitly required no translation cost. This is a contained change to the existing import workflow, rather than a new catalog or checkout system.

**Approaches considered**

1. **Website import — selected by the owner.** It covers CSVs from the existing extension and other compatible files, runs translation on the server, and can return a translated CSV for reuse. It requires a configured translation service.
2. **Extension export.** It produces translated text before download, but requires updating the installed extension and connecting it to a translation service. It covers only that exporter and is not the selected approach.

Chrome's current on-device Translator API language list does not include Azerbaijani. An offline browser translation feature therefore cannot reliably supply the requested automation with that API.

**Proposed behavior**

- For new-product imports, file checking automatically prepares Azerbaijani product names, short descriptions and full descriptions. Already Azerbaijani content is preserved where appropriate. Use the store's preferred term “ətirləndirici”. Preserve brand/model names, dimensions, quantities and factual product claims; add no unsupported specifications or benefits.
- Generate concise Azerbaijani-derived Latin slugs for new products. Keep variants grouped correctly and report collisions with existing products or reserved aliases for correction. This feature does not rename published products or rewrite their URL history.
- Show translated names and descriptions in the existing preview before saving. Add **“Azərbaycan dilində CSV-ni yüklə”** so the prepared file can be reused with its photo links and import columns.
- Translation processes only presentation text. Prices, costs, stock counts, discounts, supplier SKUs, category selections, variant identities and image URLs remain exact. The existing photo import creates alt text from the translated product name.
- A translation failure or free-service quota limit produces a clear Azerbaijani error and keeps the original file available; it must not silently import English text as a successful translation. Completed items can be retained for an explicit retry of failed work within the current import session.
- Saving retains the existing reviewed draft-import workflow, stock ledger, private supplier-code matching, automatic FC codes, duplicate protections and idempotency. Photo-only imports do not invoke translation.

**Integration and safeguards**

- Use **MyMemory’s anonymous free API**, requiring no key, account or card. Official API/usage docs and a real English→Azerbaijani sample were checked. Its published free allowance is 5 000 characters/day; quota exhaustion must stop visibly, without a billable fallback or bypass. Existing hosting/storage tariffs remain separate.
- Authenticate translation as an administrator, validate/bound inputs and outputs, apply request limits and a 40-second total deadline, and split long descriptions at word boundaries within the upstream 500-byte segment limit. Send presentation text only, without separate financial, account or customer fields.
- Preserve numeric values together with their measurement units/signs and model codes, accepting explicit localized unit aliases. Repeating a source number in a new percentage must fail. This cannot prove every arbitrary prose claim; owner review remains necessary.
- A downloaded prepared CSV can be reused without translation after the administrator explicitly confirms its Azerbaijani text has been reviewed. The spreadsheet encoding marker alone never proves language.
- Process bounded groups with progress in the import UI. Translation calls must run outside PostgreSQL transactions, with bounded timeouts and without holding database connections while waiting for the provider. Failures must not affect public storefront pages or application startup.
- Store and import the exact prepared CSV that was previewed. Maintain the current server validation and import-replay protections; no translation call is repeated during the financial/inventory transaction.
- No schema migration, checkout change, existing-product rewrite or extension update is planned. Unrelated working-tree drafts remain preserved.

**No account setup**

The owner does not need to create an OpenAI account, configure billing or add a translation secret to Vercel. The free service sends only product text to a fixed external endpoint. Use small import batches, keep the preview/review, and pause at the service's quota; no charge or automatic provider switch occurs. Source detection (`autodetect|az`) was checked with live sample data.

**Acceptance checks**

- An English anti-fog spray CSV becomes Azerbaijani in the preview and downloadable CSV, including a short description and derived slug.
- A compatible Azerbaijani CSV remains usable without unnecessary rewriting of factual content.
- Price/cost/stock/discount/SKU/category/variant/image values round-trip exactly, including decimal commas, multiline cells and grouped variants.
- Malformed, overlong or incomplete service output fails visibly; supplier text is handled as data.
- Authorization, daily quota, request rate, timeout, partial failure, retry, reviewed-file reuse and repeated-import cases are covered.
- Translation never runs inside a database transaction. The existing photo, draft/import and idempotency behavior remains covered by relevant tests.
- Existing published products, stock availability, checkout and order history retain their behavior. The new CSV workflow is not described as live until the deployed feature and free provider have been verified.

**Next step after approval**

Complete the amended implementation/tests and publish through the already authorized release workflow. Give the owner free-service usage and limit instructions; no translation account/billing setup is pending.
