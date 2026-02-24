#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"

echo "Clearing Next.js build/dev caches..."
rm -rf "$WEB_DIR/.next"
rm -rf "$WEB_DIR/node_modules/.cache"

echo "Done. Cache directories removed:"
echo " - $WEB_DIR/.next"
echo " - $WEB_DIR/node_modules/.cache"
