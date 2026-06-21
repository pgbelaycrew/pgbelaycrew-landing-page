#!/usr/bin/env bash
# Assemble a clean dist/ containing ONLY the public assets.
# Allowlist (not denylist) so .git, wrangler config, node_modules, and build
# scripts can never leak into the deployed output.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist
cp -R \
  index.html \
  docs.html \
  styles.css \
  docs.css \
  script.js \
  docs.js \
  llms.txt \
  .nojekyll \
  screens \
  dist/

echo "Built dist/ — $(find dist -type f | wc -l | tr -d ' ') files"
