-- map-recall-v1 관측 질의.
--
--   docker compose exec -T db sh -lc \
--     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < scripts/funnel.sql
--
-- 시간은 전부 at_ms(판 시작 기준 경과)로 잰다. created_at은 이벤트를 3초씩
-- 모아 보내느라 한 묶음이 거의 같은 값이 되므로 시간 계산에 쓸 수 없다.
--
-- internal = true는 개발·QA와 오답 연습 판이다. 항상 뺀다.

\set experiment 'map-recall-v1'

\echo '── 1. 퍼널 (판 단위) ─────────────────────────────────'
WITH runs AS (
  SELECT game_id,
         min(mode) AS mode,
         min(course_id) AS course_id,
         bool_or(name = 'first_correct') AS reached_first,
         bool_or(name = 'game_finish') AS finished
  FROM events
  WHERE experiment = :'experiment' AND NOT internal AND game_id IS NOT NULL
  GROUP BY game_id
)
SELECT mode, course_id,
       count(*) AS 시작,
       count(*) FILTER (WHERE reached_first) AS 첫정답,
       count(*) FILTER (WHERE finished) AS 완주,
       round(100.0 * count(*) FILTER (WHERE reached_first) / count(*), 1) AS "첫정답%",
       round(100.0 * count(*) FILTER (WHERE finished)
             / nullif(count(*) FILTER (WHERE reached_first), 0), 1) AS "첫정답→완주%"
FROM runs GROUP BY mode, course_id ORDER BY 시작 DESC;

\echo '── 2. 첫 정답까지 걸린 시간 ──────────────────────────'
-- 여기가 길어지면 첫 문제의 회상 부담이 크다는 뜻이다. 완주율만으로는
-- "어렵다"와 "관심 없다"를 구분할 수 없다.
SELECT mode, course_id,
       count(*) AS n,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY at_ms) / 1000.0)::numeric, 1) AS "중앙값초",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY at_ms) / 1000.0)::numeric, 1) AS "p90초"
FROM events
WHERE experiment = :'experiment' AND NOT internal AND name = 'first_correct' AND at_ms IS NOT NULL
GROUP BY mode, course_id ORDER BY n DESC;

\echo '── 3. 힌트를 처음 연 지점 ────────────────────────────'
-- 사용률 60%만으로는 판단할 수 없다. 첫 문제부터 60%가 쓰는 것과
-- 15문제쯤 가서 한두 번 쓰는 것은 완전히 다른 신호다.
WITH first_hint AS (
  SELECT DISTINCT ON (game_id) game_id, mode, course_id, progress, total, at_ms
  FROM events
  WHERE experiment = :'experiment' AND NOT internal AND name = 'hint_used'
  ORDER BY game_id, at_ms
)
SELECT mode, course_id,
       count(*) AS "힌트 쓴 판",
       count(*) FILTER (WHERE progress = 0) AS "첫 문제부터",
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY progress)::numeric, 1) AS "중앙 문제번호",
       round(avg(100.0 * progress / nullif(total, 0)), 1) AS "평균 진행률%"
FROM first_hint GROUP BY mode, course_id ORDER BY "힌트 쓴 판" DESC;

\echo '── 4. 판당 힌트 사용 개수 ────────────────────────────'
WITH per_run AS (
  SELECT game_id, min(mode) AS mode,
         count(*) FILTER (WHERE name = 'hint_used') AS hints,
         max(total) AS total
  FROM events
  WHERE experiment = :'experiment' AND NOT internal AND game_id IS NOT NULL
  GROUP BY game_id
)
SELECT mode,
       count(*) AS 판수,
       round(100.0 * count(*) FILTER (WHERE hints > 0) / count(*), 1) AS "힌트 쓴 판%",
       round(avg(hints), 2) AS "판당 평균",
       round(avg(100.0 * hints / nullif(total, 0)), 1) AS "문제당 사용률%"
FROM per_run GROUP BY mode ORDER BY 판수 DESC;

\echo '── 5. 힌트를 보고 나서 정답까지 ──────────────────────'
-- 짧으면 초성만 보면 떠오르는 것(실마리가 부족했다),
-- 길면 초성을 봐도 모르는 것(그 지역을 아예 모른다).
SELECT mode, course_id,
       count(*) AS n,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_ms) / 1000.0)::numeric, 1) AS "중앙값초",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY elapsed_ms) / 1000.0)::numeric, 1) AS "p90초"
FROM events
WHERE experiment = :'experiment' AND NOT internal AND name = 'hint_resolved'
GROUP BY mode, course_id ORDER BY n DESC;

\echo '── 6. 어디서 어디까지 갔다가 나갔나 ──────────────────'
-- 이탈 지점.
--
-- game_quit에 기대지 않는다. 창을 통째로 닫는 경우에는 브라우저가 이탈
-- 처리를 실행하지 않고 꺼지는 일이 있어, 이 이벤트는 "오면 좋은" 값이다.
-- 그래서 이탈 자체는 **game_finish가 없다는 사실**로 판정하고, 어디까지
-- 갔는지는 quit의 progress → 마지막 이정표(25/50/75%) 순으로 찾는다.
-- 이정표는 발생 즉시 따로 보내므로 quit보다 살아남을 확률이 높다.
WITH runs AS (
  SELECT game_id,
         min(mode) AS mode,
         min(course_id) AS course_id,
         max(total) AS total,
         bool_or(name = 'game_finish') AS finished,
         bool_or(name = 'first_correct') AS reached_first,
         -- 단위가 다르다. quit의 progress는 **끝낸 문제 수**이고
         -- game_progress의 progress는 이미 **퍼센트**(25/50/75)다.
         -- 섞어서 비교하면 3문제 푼 판이 중반 이탈로 잡힌다.
         max(progress) FILTER (WHERE name = 'game_quit') AS quit_items,
         max(progress) FILTER (WHERE name = 'game_progress') AS last_milestone
  FROM events
  WHERE experiment = :'experiment' AND NOT internal AND game_id IS NOT NULL
  GROUP BY game_id
), quit_point AS (
  SELECT *,
         coalesce(
           100.0 * quit_items / nullif(total, 0),
           last_milestone
         ) AS pct
  FROM runs WHERE NOT finished
)
SELECT mode, course_id,
       count(*) AS 이탈,
       count(*) FILTER (WHERE NOT reached_first) AS "첫 정답 전",
       count(*) FILTER (WHERE reached_first AND pct < 25) AS "초반",
       count(*) FILTER (WHERE reached_first AND pct >= 25 AND pct < 75) AS "중반",
       count(*) FILTER (WHERE reached_first AND pct >= 75) AS "막판",
       count(*) FILTER (WHERE reached_first AND pct IS NULL) AS "지점 불명"
FROM quit_point GROUP BY mode, course_id ORDER BY 이탈 DESC;

\echo '── 7. 어디서 들어온 판인가 ───────────────────────────'
SELECT source, count(*) AS 시작
FROM events
WHERE experiment = :'experiment' AND NOT internal AND name = 'game_start'
GROUP BY source ORDER BY 시작 DESC;
