#!/usr/bin/env bash
# AI-generated: written by Claude (Anthropic AI assistant) for team Earshot. See AI_USE.md.
# Build the site and publish it to the gh-pages branch (used while GitHub Actions is unavailable).
set -euo pipefail
cd "$(dirname "$0")"
npm run build
TMP=$(mktemp -d)
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll"
SHA=$(git rev-parse --short HEAD)
git -C "$TMP" init -q -b gh-pages
git -C "$TMP" add -A
git -C "$TMP" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "Built site from main $SHA"
git -C "$TMP" push -q -f "$(git remote get-url origin)" gh-pages
rm -rf "$TMP"
echo "Published $SHA to gh-pages"
