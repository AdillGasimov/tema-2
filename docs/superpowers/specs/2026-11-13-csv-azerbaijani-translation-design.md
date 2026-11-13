**Automatic Azerbaijani translation for CSV product imports**

Date: 13 November 2026. Status: proposed design, awaiting owner approval.

**Intent and scope**

The owner wants newly imported products to have Azerbaijani presentation text automatically. They selected translation during the website's CSV import, with a downloadable Azerbaijani CSV, and requested help setting up a translation API account. This is a contained change to the existing import workflow, rather than a new catalog or checkout system.

**Approaches considered**

1. **Website import — selected by the owner.** It covers CSVs from the existing extension and other compatible files, keeps the translation key on the server, and can return a translated CSV for reuse. It requires a configured translation service.
2. **Extension export.** It produces translated text before download, but requires updating the installed extension and connecting it to a translation service. It covers only that exporter and is not the selected approach.

Chrome's current on-device Translator API language list does not include Azerbaijani. An offline browser translation feature therefore cannot reliably supply the requested automation with that API.

**Proposed behavior**

- For new-product imports, file checking automatically prepares Azerbaijani product names, short descriptions and full descriptions. Already Azerbaijani content is preserved where appropriate. Use the store's preferred term “ətirləndirici”. Preserve brand/model names, dimensions, quantities and factual product claims; add no unsupported specifications or benefits.
- Generate concise Azerbaijani-derived Latin slugs for new products. Keep variants grouped correctly and report collisions with existing products or reserved aliases for correction. This feature does not rename published products or rewrite their URL history.
- Show translated names and descriptions in the existing preview before saving. Add **“Azərbaycan dilində CSV-ni yüklə”** so the prepared file can be reused with its photo links and import columns.
- Translation processes only presentation text. Prices, costs, stock counts, discounts, supplier SKUs, category selections, variant identities and image URLs remain exact. The existing photo import creates alt text from the translated product name.
- A translation failure or missing API key produces a clear Azerbaijani error and keeps the original file available; it must not silently import English text as a successful translation. Completed items can be retained for an explicit retry of failed work within the current import session.
- Saving retains the existing reviewed draft-import workflow, stock ledger, private supplier-code matching, automatic FC codes, duplicate protections and idempotency. Photo-only imports do not invoke translation.

**Integration and safeguards**

- My recommended provider is **OpenAI**, using a small text model with structured output. This is my implementation recommendation, not a provider the owner has already configured. Verify the supported model and current pricing during implementation.
- Keep `OPENAI_API_KEY` server-only. Authenticate translation as an administrator, validate and bound inputs/outputs, and apply rate/token/request limits. Treat supplier text as untrusted data, not model instructions. Send presentation text only, without financial, account or customer data.
- Process bounded groups with progress in the import UI. Translation calls must run outside PostgreSQL transactions, with bounded timeouts and without holding database connections while waiting for the provider. Failures must not affect public storefront pages or application startup.
- Store and import the exact prepared CSV that was previewed. Maintain the current server validation and import-replay protections; no translation call is repeated during the financial/inventory transaction.
- No schema migration, checkout change, existing-product rewrite or extension update is planned. Unrelated working-tree drafts remain preserved.

**API account setup — the owner's private step**

1. Sign in at https://platform.openai.com/ and create/select an API project.
2. Configure API billing and review current usage pricing. ChatGPT subscription billing is separate from API usage. Set appropriate spend alerts and available usage/rate limits; a budget alert must not be represented as a guaranteed hard spending cap.
3. Create a project API key at https://platform.openai.com/api-keys. Do not paste it into this chat or commit it to the repository.
4. Put it privately in the existing Vercel project's environment variables as `OPENAI_API_KEY` for the intended deployment environment. It must never use a `NEXT_PUBLIC_` prefix. The implementation will report missing configuration clearly instead of requiring this secret for the public site to start.
5. After implementation and deployment, verify one small import preview before processing a large file. No products are created by the translation preview alone.

**Acceptance checks**

- An English anti-fog spray CSV becomes Azerbaijani in the preview and downloadable CSV, including a short description and derived slug.
- A compatible Azerbaijani CSV remains usable without unnecessary rewriting of factual content.
- Price/cost/stock/discount/SKU/category/variant/image values round-trip exactly, including decimal commas, multiline cells and grouped variants.
- Source text cannot alter model instructions; malformed, overlong or incomplete provider output fails visibly.
- Missing-key, authorization, rate-limit, timeout, partial failure, retry and repeated-import cases are covered.
- Translation never runs inside a database transaction. The existing photo, draft/import and idempotency behavior remains covered by relevant tests.
- Existing published products, stock availability, checkout and order history retain their behavior. The new CSV workflow is not described as live until the deployed feature and privately configured provider have been verified.

**Next step after approval**

Write the implementation plan, build and test the contained import feature, and provide the private Vercel setup instructions. Account creation and billing remain actions in the owner's own provider account.
