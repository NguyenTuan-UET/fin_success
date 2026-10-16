#!/usr/bin/env bash
# Sao lưu CSDL (pg_dump, định dạng custom) và kho tệp đã mã hóa. Giữ 14 bản gần nhất.
#   scripts/backup.sh                 # dùng DATABASE_URL hoặc cụm cục bộ
#   BACKUP_DIR=/mnt/backup scripts/backup.sh
# Lưu ý: khóa FCC_DATA_KEY (hoặc data/data.key ở dev) phải được cất RIÊNG khỏi bản sao lưu — mất khóa là mất tệp.
set -euo pipefail
cd "$(dirname "$0")/.."
URL="${DATABASE_URL:-postgres://fcc@/fcc?host=$PWD/data/pg-run&port=5433}"
OUT="${BACKUP_DIR:-$PWD/backups}"
ANY=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
# dùng pg_dump/pg_restore cùng phiên bản chính với máy chủ (công cụ mới hơn có thể sinh lệnh mà máy chủ cũ không hiểu)
MAJOR=$("$ANY/psql" "$URL" -Atc "SHOW server_version_num" | cut -c1-2)
BIN=/usr/lib/postgresql/$MAJOR/bin; [ -x "$BIN/pg_dump" ] || BIN=$ANY
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$OUT"
"$BIN/pg_dump" --format=custom --no-owner --dbname="$URL" --file="$OUT/fcc-$STAMP.dump"
if [ -d data/objects ]; then tar -C data -czf "$OUT/objects-$STAMP.tar.gz" objects; fi
( cd "$OUT" && sha256sum fcc-$STAMP.dump $( [ -f objects-$STAMP.tar.gz ] && echo objects-$STAMP.tar.gz ) > "manifest-$STAMP.sha256" )
ls -1t "$OUT"/fcc-*.dump | tail -n +15 | while read -r f; do s=${f##*/fcc-}; s=${s%.dump}; rm -f "$OUT"/*-"$s".*; done
echo "Đã sao lưu: $OUT/fcc-$STAMP.dump"
