#!/usr/bin/env bash
# Chạy backend ở chế độ production trên máy này (để Vercel gọi qua tunnel). Cấu hình ở server/.env.production (gitignored).
#   scripts/pg-local.sh start && scripts/run-public.sh
# Backend chỉ nghe 127.0.0.1:8787; đưa ra Internet bằng tunnel (cloudflared), không mở cổng trên router.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.production ] || { echo "Thiếu server/.env.production (mẫu: .env.production.example)"; exit 1; }
exec npx tsx --env-file=.env.production src/index.ts
