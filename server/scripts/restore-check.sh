#!/usr/bin/env bash
# Diễn tập khôi phục: nạp bản sao lưu mới nhất vào một CSDL tạm, kiểm tra checksum, số bản ghi và chuỗi băm nhật ký,
# rồi xóa CSDL tạm. Không đụng tới CSDL đang chạy.
#   scripts/restore-check.sh [tệp.dump]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${BACKUP_DIR:-$PWD/backups}"
DUMP="${1:-$(ls -1t "$OUT"/fcc-*.dump | head -1)}"
STAMP=${DUMP##*/fcc-}; STAMP=${STAMP%.dump}
( cd "$(dirname "$DUMP")" && sha256sum -c "manifest-$STAMP.sha256" )
TAKEN=$(date -u -d "$(echo "$STAMP" | sed -E 's/(....)(..)(..)T(..)(..)(..)Z/\1-\2-\3 \4:\5:\6/')" +%s)
echo "Tuổi bản sao lưu: $(( ($(date -u +%s) - TAKEN) / 3600 )) giờ — dữ liệu sau thời điểm này sẽ mất nếu khôi phục bây giờ (RPO thực tế)"
OBJ="$(dirname "$DUMP")/objects-$STAMP.tar.gz"
if [ -f "$OBJ" ]; then echo "Kho tệp: $(tar -tzf "$OBJ" | grep -vc '/$') tệp mã hóa (cần FCC_DATA_KEY cất riêng để đọc)"
else echo "CẢNH BÁO: thiếu objects-$STAMP.tar.gz — chứng từ đã tải lên sẽ không khôi phục được"; fi
ADMIN_URL="${RESTORE_ADMIN_URL:-postgres://fcc@/postgres?host=$PWD/data/pg-run&port=5433}"
ANY=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
# dùng pg_dump/pg_restore cùng phiên bản chính với máy chủ (công cụ mới hơn có thể sinh lệnh mà máy chủ cũ không hiểu)
MAJOR=$("$ANY/psql" "$ADMIN_URL" -Atc "SHOW server_version_num" | cut -c1-2)
BIN=/usr/lib/postgresql/$MAJOR/bin; [ -x "$BIN/pg_dump" ] || BIN=$ANY
TMPDB="fcc_restore_$(date +%s)"
"$BIN/psql" "$ADMIN_URL" -qc "CREATE DATABASE $TMPDB"
trap '"$BIN/psql" "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $TMPDB" >/dev/null' EXIT
TMP_URL="${ADMIN_URL/\/postgres?//$TMPDB?}"
START=$(date +%s)
"$BIN/pg_restore" --no-owner --dbname="$TMP_URL" "$DUMP"
npx tsx scripts/verify-db.ts "$TMP_URL"
echo "Khôi phục và kiểm tra xong trong $(( $(date +%s) - START )) giây: $DUMP"
