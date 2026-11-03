# Browser extensions

`birmarket-product-exporter` is a self-contained Manifest V3 extension. Installation and usage are described in its bundled README. The store application's existing unpublished CSV work is preserved.

Run the extension's pure logic assertions with:

```sh
node extensions/tests/birmarket-core.test.mjs
```

`npm test` includes the real shop-parser compatibility tests. Browser fixture checks use the existing Playwright installation:

```sh
node extensions/tests/test-birmarket-browser.mjs
```

The browser test expects a current public HTML snapshot at `/tmp/birmarket-product-2850424.html` or `BIRMARKET_HTML`. It strips executable site scripts and prevents network access during fixture execution. Its Chrome API adapter is test-only and is not shipped in the extension. The separate `test-birmarket-native.mjs` harness requires a browser that supports unpacked extension loading; this managed browser reported that capability unavailable.

Package the public runtime assets and check ZIP integrity:

```sh
python3 scripts/package-birmarket-extension.py --output-dir /workspace/artifacts
```

The ZIP excludes test adapters, browser profiles, downloads, environment files and credentials. No store deployment or Chrome Web Store publication is performed by packaging.
