"""Package only the extension's public runtime assets, never profiles/test data."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("--output-dir", type=Path, default=Path(".local/artifacts"))
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / "extensions/birmarket-product-exporter"
files = ["manifest.json", "package.json", "core.js", "extractor.js", "background.js", "client.js", "popup.html", "popup.js", "manager.html", "manager.js", "styles.css", "README.md", "icons/16.png", "icons/48.png", "icons/128.png"]
manifest = json.loads((source / "manifest.json").read_text())
assert manifest["manifest_version"] == 3
assert manifest["host_permissions"] == ["https://birmarket.az/*", "https://www.birmarket.az/*"]
for file in files:
    item = source / file
    if not item.is_file() or item.is_symlink():
        raise RuntimeError(f"Missing or unexpected runtime file: {file}")
args.output_dir.mkdir(parents=True, exist_ok=True)
archive = args.output_dir / "birmarket-product-exporter.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for file in files:
        info = zipfile.ZipInfo("birmarket-product-exporter/" + file)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        output.writestr(info, (source / file).read_bytes())
with zipfile.ZipFile(archive) as check:
    if check.testzip() is not None:
        raise RuntimeError("ZIP integrity check failed")
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(args.output_dir / "birmarket-product-exporter.zip.sha256").write_text(f"{digest}  {archive.name}\n")
print(f"Packaged {len(files)} files: {archive} ({archive.stat().st_size} bytes)")
