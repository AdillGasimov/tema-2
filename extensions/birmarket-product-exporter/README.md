# Birmarket Product CSV Exporter

An unpacked Chrome Manifest V3 extension for the Birmarket product pages you open. It saves a local collection and exports CSV files with product names, specifications, brand, source prices and direct photo URLs. It was checked against the owner's microfiber-cloth page and browser fixtures on 3 November 2026.

## Install

1. Download and unzip `birmarket-product-exporter.zip`.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** at the top right.
4. Click **Load unpacked** and choose the extracted `birmarket-product-exporter` folder containing `manifest.json`.
5. Pin **Birmarket Product CSV Exporter** using Chrome's puzzle-piece menu.

Keep the extracted folder: Chrome loads the extension from it. No Chrome Web Store publication or website deployment is needed.

## Collect products

1. Open a product on `https://birmarket.az/product/...` and wait for its details to load.
2. Click the extension icon, then **Bu məhsulu yadda saxla** (save this product).
3. Repeat for other product pages. The icon badge shows the saved count.
4. Click **Kolleksiyanı aç** (open collection) to review and edit the saved products.

Saving a product again updates its source details while preserving your selling price, cost, stock and other edits. The collection is stored in Chrome on this browser profile. Its limit is 200 products; export before clearing it for the next batch. Each product ID is one collection entry. Variant labels are recorded where the page exposes them; prices and stock for unvisited variants are not invented.

## Export choices

**Tam CSV yüklə** — full CSV, including `image_urls`, `source_url`, `source_price_azn`, specifications and other source fields. Multiple photo URLs are separated by ` | `. The updated store importer accepts this file directly and copies supported Birmarket photos into the store's private image storage. For new products, fill your own selling price, purchase cost and stock first. For products already imported, select **Mövcud məhsullara yalnız şəkil əlavə et (SKU ilə)** in the store to attach photos by SKU without changing prices or stock. These are photo links, not embedded image files; source links must remain available during import. The installed version 1.0.0 already exports this format; reinstalling is unnecessary.

**Mağaza CSV-lərini yüklə** — metadata-only CSV files matching the store importer, automatically batched at no more than 50 rows and 512 KiB per file. These files do not contain photo links; use **Tam CSV yüklə** for photos. Fill **Satış AZN** (your selling price), **Maya AZN** (your actual purchase cost), and **Stok** (your stock quantity). Birmarket's price is displayed separately and never treated as your price or cost automatically. A real zero must be entered explicitly. Missing or invalid business data blocks this export. Use your store's category name/slug, or leave category blank and choose a common category on the store's import screen.

The store format is:

```csv
name,sku,price,cost,stock,category,description,slug,variant,discount
```

Exported SKUs default to `BM-<Birmarket product ID>`. URL slugs include the product ID to avoid collisions between similarly named products. Names and descriptions can be edited in the collection. Intentional variant groups stay together within each 50-row file. The site importer still checks for SKUs/slugs that already exist in your live catalog.

Photo URLs remain in the full CSV. The current store CSV feature imports text, prices, stock and variants; automatic fetching of those photos is a separate store feature. Use the existing product photo uploader until that feature is added. This extension makes no changes to your store.

## Data and permissions

- Product extraction is triggered by your click and limited to HTTPS Birmarket product pages.
- The extension reads product-specific structured data, gallery images and specification rows. It uses no cookies/history permissions, telemetry, account login or external code.
- `scripting` and the two Birmarket host permissions read the opened product page; `storage` saves your collection; `downloads` writes the CSV files you request.
- Product text is rendered as text and CSV formula prefixes are escaped. Private marketplace account/cart data is not collected.
- A CAPTCHA, incomplete page load or site layout change may prevent extraction. Open the page normally, wait for it to load and retry; no access-control bypass is included.
- Source photo links can change or expire. Review product details and your business values before importing.

## Files and verification

`extractor.js` reads the page; `core.js` normalizes products and formats CSV; the service worker serializes collection changes; popup/manager pages provide the interface. Everything needed to run is bundled locally. The development tests and scripts are outside the downloadable extension folder.

Verification here covers the CSV logic, compatibility with the actual shop parser, and Chromium page/UI/download tests using an explicit Chrome-API adapter. The native unpacked-extension harness could not run because this environment's browser reports `Extensions.loadUnpacked: Method not available`. Actual installation and native Chrome permissions/storage/download APIs still need a check in your local Chrome. This limitation is separate from the successful live product-page fetch and extraction tests.
