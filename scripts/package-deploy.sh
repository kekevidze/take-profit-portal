#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -n "${1:-}" && "$1" == /* ]]; then
  OUT_FILE="$1"
else
  OUT_FILE="${ROOT}/${1:-take-profit-portal-deploy.zip}"
fi
STAGING="${ROOT}/deploy-staging/take-profit-portal"

rm -rf "${ROOT}/deploy-staging"
mkdir -p "$STAGING"

rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude deploy-staging \
  --exclude .cursor \
  --exclude .env \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude db.json \
  --exclude vercel.json \
  --exclude api \
  --exclude '*.zip' \
  --exclude .DS_Store \
  --exclude '*.log' \
  "${ROOT}/" "${STAGING}/"

cd "${ROOT}/deploy-staging"
rm -f "${OUT_FILE}"
zip -r -q "${OUT_FILE}" take-profit-portal
rm -rf "${ROOT}/deploy-staging"

echo "Created ${OUT_FILE}"
