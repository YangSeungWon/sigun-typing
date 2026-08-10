#!/bin/sh
# 백업 복원 예행연습.
#
# 백업이 매일 돌고 있다는 것과 그 파일로 실제로 되살릴 수 있다는 것은
# 다른 이야기다. 둘 사이의 거리는 대개 정작 필요한 날에 발견된다 —
# 덤프가 비어 있었다거나, 스키마만 있고 데이터가 없었다거나,
# 압축이 도중에 끊겨 있었다거나.
#
# 그래서 진짜로 복원해 본다. 일회용 포스트그레스를 띄워 가장 최근
# 백업을 부어 넣고, 표와 행 수를 세어 지금 돌고 있는 DB와 맞춰 본다.
# 운영 DB에는 손대지 않는다 — 읽기만 한다.
#
#   sh scripts/restore-drill.sh            가장 최근 백업으로
#   sh scripts/restore-drill.sh <파일>     특정 백업으로
set -eu

DIR=${BACKUP_DIR:-./backups}
FILE=${1:-$(ls -1t "$DIR"/sigun-*.sql.gz 2>/dev/null | head -1)}
IMAGE=postgres:17-alpine
NAME=sigun-restore-drill
PASS=drill

if [ -z "${FILE:-}" ] || [ ! -f "$FILE" ]; then
  echo "복원할 백업이 없습니다: $DIR" >&2
  exit 1
fi

echo "백업     $FILE ($(wc -c < "$FILE") bytes, $(date -r "$FILE" '+%Y-%m-%d %H:%M'))"

# 압축이 온전한지부터. 여기서 걸리면 그 백업은 처음부터 쓸모가 없었다.
gzip -t "$FILE"
echo "압축     온전함"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PASS" -e POSTGRES_DB=drill "$IMAGE" >/dev/null

# 뜰 때까지 기다린다. pg_isready로는 모자란다 — 포스트그레스는 초기화하는
# 동안 임시 서버를 한 번 띄웠다 내리므로, 그 사이에 준비된 것처럼 보인다.
# 실제로 질의가 통할 때까지 기다린다.
i=0
until docker exec "$NAME" psql -U postgres -d drill -c 'select 1' >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && { echo "일회용 DB가 뜨지 않습니다" >&2; exit 1; }
  sleep 1
done

# 덤프에는 소유자를 운영 계정으로 돌리는 구문이 들어 있다. 빈 서버에는 그
# 계정이 없어 전부 실패하는데, 실제 복구도 똑같이 겪는 일이라 여기서 미리
# 만들어 둔다. 이 한 줄이 복구 절차의 첫 단계이기도 하다.
docker exec "$NAME" psql -q -U postgres -d drill \
  -c "create role \"${POSTGRES_USER:-sigun}\" login superuser password 'drill'" >/dev/null

ERRLOG=$(mktemp)
gunzip -c "$FILE" | docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=0 -U postgres -d drill \
  >/dev/null 2>"$ERRLOG" || true
if [ -s "$ERRLOG" ]; then
  echo "복원     경고 있음"
  sed 's/^/         /' "$ERRLOG" | head -10
  FAILED_RESTORE=1
else
  echo "복원     오류 없음"
  FAILED_RESTORE=0
fi
rm -f "$ERRLOG"

count() { docker exec "$NAME" psql -tAX -U postgres -d drill -c "$1" 2>/dev/null || echo "?"; }

TABLES=$(count "select string_agg(tablename, ' ' order by tablename) from pg_tables where schemaname='public'")
echo "표       ${TABLES:-없음}"

# 지금 돌고 있는 DB와 대조한다. 행 수는 백업 시점 이후에 쌓인 만큼 당연히
# 다르므로 참고로만 적고, **스키마가 같은지**를 본다. 그게 "이 백업으로
# 지금 코드를 그대로 띄울 수 있는가"에 대한 답이다.
live() {
  docker compose exec -T db psql -tAX -U "${POSTGRES_USER:-sigun}" -d "${POSTGRES_DB:-sigun}" \
    -c "$1" 2>/dev/null | tr -d ' \r' || echo "?"
}

FAIL=$FAILED_RESTORE
COLUMNS="select table_name || '.' || column_name || ':' || data_type
         from information_schema.columns where table_schema='public'
         order by table_name, column_name"
R_COLS=$(count "$COLUMNS" | tr -d ' \r' | sort)
L_COLS=$(live "$COLUMNS" | sort)
if [ "$L_COLS" = "?" ] || [ -z "$L_COLS" ]; then
  echo "스키마   운영 DB를 읽을 수 없어 대조를 건너뜁니다"
elif [ "$R_COLS" = "$L_COLS" ]; then
  echo "스키마   운영과 같음 ($(echo "$R_COLS" | wc -l)개 칼럼)"
else
  echo "스키마   운영과 다릅니다"
  A=$(mktemp); B=$(mktemp)
  echo "$L_COLS" > "$A"; echo "$R_COLS" > "$B"
  diff "$A" "$B" | sed 's/^/         /' | head -20
  rm -f "$A" "$B"
  FAIL=1
fi

for t in $TABLES; do
  R=$(count "select count(*) from $t" | tr -d ' \r')
  L=$(live "select count(*) from $t")
  printf '%-14s 복원 %-8s 운영 %s\n' "$t" "$R" "$L"
  # 운영에 데이터가 있는데 백업에는 한 줄도 없으면 그 백업은 껍데기다.
  if [ "$L" != "?" ] && [ "${R:-0}" -eq 0 ] && [ "${L:-0}" -gt 0 ] 2>/dev/null; then
    echo "               ↑ 운영에는 있는데 백업에는 없습니다"
    FAIL=1
  fi
done

# 표가 하나도 없으면 덤프가 비어 있었다는 뜻이다. 그건 백업이 아니다.
if [ -z "${TABLES:-}" ]; then
  echo "표가 하나도 복원되지 않았습니다 — 이 백업은 쓸 수 없습니다" >&2
  exit 1
fi

[ "$FAIL" -eq 0 ] && echo "판정     복원 가능" || { echo "판정     확인 필요" >&2; exit 1; }
