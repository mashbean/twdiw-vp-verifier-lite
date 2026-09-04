#!/usr/bin/env bash
# Downloads the two public OpenAC age-profile verifying keys from the immutable
# `openac-age-v1` release of bonds-tw/backupTW-iOS and checks both the gzip
# transport and the installed bytes against the release-gate pins recorded in
# Native/OpenACAge/RELEASE-openac-age-v1.md. Anything that does not match is
# deleted, never used.
set -euo pipefail

release="https://github.com/bonds-tw/backupTW-iOS/releases/download/openac-age-v1"
keys_dir="${OPENAC_AGE_KEYS_DIR:-$(cd "$(dirname "$0")/.." && pwd)/keys}"
mkdir -p "$keys_dir"

# name | gzip sha256 | installed sha256 | installed bytes
pins=(
  "prepare_verifying.key d84ef20b28f0dd26b836022fc023424592d476a80b54d9ab80d51e43f698ee6a 9b45cc7462a236b1056d21c19e1e4dfc2cf52fd20538d43fbe072d9ed106e9d6 431866442"
  "show_verifying.key b6daa9cefd23d27ce80bd182ced987caa1a4eeb91083fc6ceafbeb1210dfbad0 f0c447a9757d182e8aa23083bc3dba5a9a22f3e0fcbb344724568cc3c83352d8 4862746"
)

sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
size() { stat -f %z "$1" 2>/dev/null || stat -c %s "$1"; }

for pin in "${pins[@]}"; do
  read -r name gzip_sha installed_sha installed_bytes <<<"$pin"
  target="$keys_dir/$name"
  if [ -f "$target" ] && [ "$(size "$target")" = "$installed_bytes" ] && [ "$(sha "$target")" = "$installed_sha" ]; then
    echo "$name already installed and pinned"
    continue
  fi
  echo "downloading $name.gz"
  curl -fL --progress-bar "$release/$name.gz" -o "$target.gz"
  if [ "$(sha "$target.gz")" != "$gzip_sha" ]; then
    rm -f "$target.gz"; echo "gzip hash mismatch for $name — refusing" >&2; exit 65
  fi
  gunzip -f "$target.gz"
  if [ "$(size "$target")" != "$installed_bytes" ] || [ "$(sha "$target")" != "$installed_sha" ]; then
    rm -f "$target"; echo "installed hash mismatch for $name — refusing" >&2; exit 65
  fi
  echo "$name installed and pinned"
done
echo "verifying keys ready in $keys_dir"
