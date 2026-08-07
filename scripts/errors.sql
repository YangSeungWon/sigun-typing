-- 오류 조회.
--
--   docker compose exec -T db sh -lc \
--     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < scripts/errors.sql
--
-- 컨테이너 로그에도 같은 내용이 `[error]`로 시작하는 줄로 남는다.
--   docker compose logs web socket | grep '^\[error\]'
-- DB가 죽어서 난 오류는 DB에 못 남으므로 그때는 로그 쪽만 남는다.

\echo '── 최근 24시간 요약 ─────────────────────────────────'
SELECT source, kind, path, message, count(*) AS 건수,
       to_char(max(created_at) AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS 마지막
FROM errors
WHERE created_at >= now() - interval '24 hours'
GROUP BY source, kind, path, message
ORDER BY 건수 DESC, 마지막 DESC
LIMIT 30;

\echo '── 시간별 추이 (최근 3일) ───────────────────────────'
-- 배포 직후에만 몰려 있으면 그 배포가 원인이다.
SELECT to_char(date_trunc('hour', created_at) AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24시') AS 시각,
       count(*) FILTER (WHERE source = 'server') AS 서버,
       count(*) FILTER (WHERE source = 'client') AS 브라우저
FROM errors
WHERE created_at >= now() - interval '3 days'
GROUP BY 1 ORDER BY 1 DESC LIMIT 24;

\echo '── 가장 최근 다섯 건 (스택 포함) ────────────────────'
SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI:SS') AS 시각,
       source, path, message, left(coalesce(stack, ''), 400) AS stack
FROM errors ORDER BY created_at DESC LIMIT 5;
