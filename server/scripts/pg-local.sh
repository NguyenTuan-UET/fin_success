#!/usr/bin/env bash
# Cụm PostgreSQL riêng cho phát triển/kiểm thử, do user hiện tại sở hữu (không cần sudo, không đụng cụm hệ thống).
# Dữ liệu ở server/data/pg (đã gitignore). Chỉ mở socket Unix ở server/data/pg-run, không mở cổng TCP.
#   scripts/pg-local.sh start   # khởi tạo (lần đầu) và chạy; in DATABASE_URL
#   scripts/pg-local.sh stop
#   scripts/pg-local.sh status
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | head -1)
[ -x "$BIN/pg_ctl" ] || { echo "Không tìm thấy PostgreSQL (cần initdb, pg_ctl)"; exit 1; }
DATA="$PWD/data/pg"
RUN="$PWD/data/pg-run"
LOG="$PWD/data/pg.log"
PORT=5433
URL="postgres://fcc@/fcc?host=$RUN&port=$PORT"

case "${1:-start}" in
  start)
    mkdir -p "$RUN"
    if [ ! -f "$DATA/PG_VERSION" ]; then
      "$BIN/initdb" -D "$DATA" -U fcc --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
      cat >> "$DATA/postgresql.conf" <<EOF
listen_addresses = ''
port = $PORT
unix_socket_directories = '$RUN'
EOF
    fi
    if ! "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      "$BIN/pg_ctl" -D "$DATA" -l "$LOG" -w start >/dev/null
    fi
    "$BIN/psql" -h "$RUN" -p $PORT -U fcc -d postgres -Atc "select 1 from pg_database where datname='fcc'" | grep -q 1 \
      || "$BIN/createdb" -h "$RUN" -p $PORT -U fcc fcc
    "$BIN/psql" -h "$RUN" -p $PORT -U fcc -d postgres -Atc "select 1 from pg_database where datname='fcc_test'" | grep -q 1 \
      || "$BIN/createdb" -h "$RUN" -p $PORT -U fcc fcc_test
    echo "DATABASE_URL=$URL"
    ;;
  stop) "$BIN/pg_ctl" -D "$DATA" -w stop ;;
  status) "$BIN/pg_ctl" -D "$DATA" status ;;
  *) echo "Dùng: $0 start|stop|status"; exit 1 ;;
esac
