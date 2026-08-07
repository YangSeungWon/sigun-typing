#!/bin/sh
# 랭킹 백업.
#
# 코드도 지역 자료도 저장소에서 되살릴 수 있지만, 남이 남긴 기록만은
# 되살릴 수 없다. `docker compose down -v` 한 번이면 사라지는 자리라
# 사람 손에 맡기지 않고 컨테이너가 알아서 돌게 둔다.
#
# 하루 한 번 pg_dump를 뜨고 RETAIN_DAYS일이 지난 것은 지운다.
# 파일은 ./backups에 남으므로, 이 디렉터리를 서버 밖으로 한 번 더
# 옮겨 두면 디스크가 통째로 죽는 경우까지 대비된다.
set -eu

DIR=${BACKUP_DIR:-/backups}
RETAIN=${RETAIN_DAYS:-14}
EVERY=${INTERVAL_SECONDS:-86400}

mkdir -p "$DIR"

dump() {
  stamp=$(date +%Y%m%d-%H%M%S)
  tmp="$DIR/.$stamp.partial"
  out="$DIR/sigun-$stamp.sql.gz"

  # 먼저 임시 이름으로 받고 성공했을 때만 옮긴다. 도중에 죽은 파일이
  # 백업처럼 보이면, 정작 복구할 때 그게 비어 있다는 걸 알게 된다.
  if pg_dump -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" | gzip > "$tmp"; then
    mv "$tmp" "$out"
    echo "[backup] $out ($(wc -c < "$out") bytes)"
  else
    rm -f "$tmp"
    echo "[backup] 실패 — 이번 회차를 건너뜁니다" >&2
    return 1
  fi

  find "$DIR" -name 'sigun-*.sql.gz' -mtime "+$RETAIN" -delete
}

# 뜨자마자 한 번 뜬다. 컨테이너가 자주 재시작되는 상황에서 하루를
# 기다리다 한 번도 못 뜨는 일을 막는다.
while true; do
  dump || true
  sleep "$EVERY"
done
