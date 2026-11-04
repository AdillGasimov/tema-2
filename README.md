# Birmarket & Temu Product CSV Exporter — 1.1.0

An unpacked Chrome Manifest V3 extension for product pages you open on Birmarket and Temu. Save a local collection, enter your own business values, and export a Full CSV containing product details and photo URLs for your store's importer.

## Update an existing installation

1. Export **Tam CSV yüklə** from your current extension as a backup.
2. Unzip the new download. Copy its files into the **same original `birmarket-product-exporter` folder** Chrome already uses, replacing the old files. Keep the folder path unchanged.
3. Open `chrome://extensions` and click **Reload** on the existing extension. Allow Temu access if Chrome asks.
4. Open the collection and check your saved products. Version 1.1.0 uses the same `products` storage key and keeps old Birmarket IDs and edits.

Do not remove the existing extension or use **Clear collection** during the update. Loading a different folder as a new extension can create separate storage; the original collection remains with the original installation. Keep your backup.

## First installation

1. Unzip `birmarket-product-exporter.zip` and keep the extracted folder.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `birmarket-product-exporter` folder containing `manifest.json`.
4. Pin **Birmarket & Temu Product CSV Exporter** using Chrome's puzzle-piece menu.

## Collect and import

1. Open a Birmarket product or a full Temu product page. Wait until its actual name and photos are visible. If Temu asks you to sign in, do that normally in Temu first; the extension does not sign in for you.
2. Click the extension icon → **Bu məhsulu yadda saxla**. Repeat for other products.
3. Open **Kolleksiyanı aç**. Fill **Satış AZN**, **Maya AZN**, **Stok**, and the store category for each new product. Review the product name and description. Source prices/currencies are separate; no automatic currency conversion is performed.
4. Save your edits and click **Tam CSV yüklə**.
5. In the store, open **Məhsullar → CSV idxalı**, choose the CSV and default category if needed, then **Faylı yoxla → Qaralamaları əlavə et**. Photos are copied to the store's connected private storage. Wait for photo progress to finish; failed photos have a retry button.
6. Review the drafts and publish the products when ready.

For products already in your store, select **Mövcud məhsullara yalnız şəkil əlavə et (SKU ilə)** and upload Full CSV. This attaches photos without changing existing prices or stock.

The collection holds up to 200 products across both sources. Resaving a product updates its source details while preserving your edited selling price, cost, stock and description. Each product ID is one entry; unvisited variant prices and stock are not invented.

## CSV formats

**Tam CSV yüklə** includes the store fields plus `image_urls`, clean `source_url`, `source_price`, `source_currency`, specifications and other source fields. Photo URLs are separated by ` | `; the file contains links, not embedded image bytes. The older `source_price_azn` column remains for compatibility and is populated only when the source explicitly reports AZN. The store accepts both old Birmarket Full CSV and new mixed-source Full CSV, up to 200 rows/512 KiB.

**Mağaza CSV-lərini yüklə** exports metadata-only batches of at most 50 rows/512 KiB. It requires complete, valid business values. These files have no photo links; use Full CSV for photos.

Store fields are `name, sku, price, cost, stock, category, description, slug, variant, discount`. Selling price and purchase cost are always your own AZN amounts. Do not substitute a foreign-currency source price or assume stock from the source listing. Enter zero only when it is the real value.

Default Birmarket SKUs stay `BM-<product ID>`. Temu uses `TM-<goods ID>` and separate collection IDs `temu-<goods ID>`, preventing cross-source collisions. Temu slugs are prefixed with `temu-`. Existing store/deleted-product SKU and slug conflicts are still checked by the importer.

## Data and permissions

- Capture runs only after your click, on validated HTTPS Birmarket or Temu product pages. Open short/share links in Chrome until they resolve to the full product page first.
- Host permissions are limited to `birmarket.az`, `www.birmarket.az`, `temu.com` and `www.temu.com`. `scripting` reads the selected product, `storage` saves the collection, and `downloads` writes requested CSVs. No cookies/history permissions or telemetry are used.
- Temu capture reads product structured data, verified goods-ID page state, and matching product/gallery metadata in the page's MAIN world. It does not evaluate downloaded scripts or read account storage/cookies. Only product fields are returned. Tracking/session/advertising parameters are removed from saved product URLs.
- Wrong-product recommendations, unsupported images, unready pages and login/verification pages are rejected. A site layout change can require an extractor update. Use the site normally and retry once the actual product is visible; no login, CAPTCHA or access-control bypass is included.
- Temu product images are limited to supported product paths on the known `img*.kwcdn.com` hosts. Up to 12 unique photos are captured. The store also enforces 12 images/product, 4 MiB/image and actual image decoding before storing WebP copies.
- Product text is rendered as text, and spreadsheet formula prefixes are escaped. Source links can expire; review every product and your business values before publishing.

## Verification and limits

The package contains only bundled runtime assets. Unit tests cover old/new URL identities, mixed Full CSV compatibility, currency separation and preserving business edits. Chromium UI/download tests use an explicit Chrome-API adapter and exercise Birmarket HTML plus Temu structured-data, goods-state and DOM fixtures, recommendation filtering, login/verification rejection and old-collection compatibility.

The owner's Temu image was fetched successfully from the actual CDN (JPEG, 800×800). The public Temu product URL redirects this environment's unauthenticated Chromium session to login, so live logged-in Temu metadata extraction is not claimed verified here. Open the product in your own signed-in Chrome session to check its capture. Test fixture prices/details are not advertised as the real product's price or specifications.

Native unpacked-extension loading is unavailable in this environment (`Extensions.loadUnpacked: Method not available`). Chrome API calls are adapted in the browser tests; actual host-permission prompts, native storage persistence and native downloads still need a check in your local Chrome.
