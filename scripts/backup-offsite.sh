#!/bin/sh
# 백업을 서버 밖으로 한 벌 더 옮긴다.
#
# 지금 백업은 운영 서버의 같은 디스크에 쌓인다. 실수로 지운 표나 잘못된
# 마이그레이션은 그걸로 되살릴 수 있지만, 디스크가 통째로 죽거나 서버를
# 잃으면 DB와 백업이 함께 사라진다. 한 벌은 다른 곳에 있어야 한다.
#
# 목적지는 rsync가 아는 형식이면 무엇이든 된다.
#
#   OFFSITE_DEST=/mnt/backup-disk/sigun          다른 디스크
#   OFFSITE_DEST=user@nas.local:/volume1/sigun   집 NAS·다른 서버
#
# 원격이면 키 로그인이 되어 있어야 한다(암호를 물으면 cron에서 멈춘다).
#
#   sh scripts/backup-offsite.sh
#
# cron 예시 — 백업이 뜬 뒤인 새벽 6시:
#   0 6 * * * cd /srv/sigun-typing && OFFSITE_DEST=... sh scripts/backup-offsite.sh >> /var/log/sigun-offsite.log 2>&1
set -eu

SRC=${BACKUP_DIR:-./backups}
DEST=${OFFSITE_DEST:-}

if [ -z "$DEST" ]; then
  echo "OFFSITE_DEST가 비어 있습니다. 옮길 곳을 정해 주세요." >&2
  echo "  예) OFFSITE_DEST=/mnt/backup-disk/sigun sh $0" >&2
  exit 2
fi

if [ ! -d "$SRC" ]; then
  echo "백업 디렉터리가 없습니다: $SRC" >&2
  exit 1
fi

COUNT=$(find "$SRC" -name 'sigun-*.sql.gz' | wc -l | tr -d ' ')
if [ "$COUNT" -eq 0 ]; then
  echo "옮길 백업이 없습니다: $SRC" >&2
  exit 1
fi

# 원본은 지우지 않는다(--delete 없음). 서버 쪽 보존 기간이 짧아지더라도
# 밖에 있는 사본까지 함께 사라지면 안 된다 — 그게 이 사본의 존재 이유다.
rsync -a --info=stats1 --include='sigun-*.sql.gz' --exclude='*' "$SRC"/ "$DEST"/

# 옮겨 놓기만 하고 끝내지 않는다. 원격에서 세어 보고 개수가 모자라면 알린다.
case "$DEST" in
  *:*)
    HOST=${DEST%%:*}
    PATH_=${DEST#*:}
    THERE=$(ssh -o BatchMode=yes "$HOST" "ls -1 '$PATH_'/sigun-*.sql.gz 2>/dev/null | wc -l" | tr -d ' ')
    ;;
  *)
    THERE=$(find "$DEST" -name 'sigun-*.sql.gz' | wc -l | tr -d ' ')
    ;;
esac

echo "여기 ${COUNT}개 · 저기 ${THERE}개 → $DEST"
if [ "${THERE:-0}" -lt "$COUNT" ]; then
  echo "사본이 모자랍니다 — 복사가 끝까지 가지 않았습니다" >&2
  exit 1
fi
echo "판정     사본 있음"
