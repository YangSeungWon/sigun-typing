import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * 랭킹 테이블.
 *
 * 검증을 통과한 기록만 들어온다. 점수 컬럼은 전부 **서버가 다시 계산한 값**이고
 * 클라이언트가 주장한 값은 저장하지 않는다 — 나중에 둘을 헷갈릴 여지를 없애기 위해서다.
 */
export const scores = pgTable(
  "scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 토큰의 sessionId. 같은 판을 두 번 제출하는 것을 막는다. */
    sessionId: uuid("session_id").notNull(),
    courseId: text("course_id").notNull(),
    mode: text("mode").notNull(),
    nickname: text("nickname").notNull(),
    /** 기기 식별용 익명 토큰. 로그인 대신 쓰고 개인정보는 담지 않는다. */
    deviceId: text("device_id").notNull(),
    /**
     * 이 기록을 계산한 채점 규칙 버전. 규칙이 바뀌면 옛 기록과 비교할 수 없으므로
     * 순위표는 같은 버전끼리만 모은다. lib/score/version.ts 참고.
     */
    scoringVersion: integer("scoring_version").notNull().default(1),
    /**
     * 코스 판번호. 장소·순서·정답 판정이 바뀌면 옛 기록과 비교할 수 없다.
     * scoringVersion과 함께 두 축으로 비교 가능성을 정한다.
     */
    courseVersion: integer("course_version").notNull().default(1),

    cpm: real("cpm").notNull(),
    accuracy: real("accuracy").notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    correctKeystrokes: integer("correct_keystrokes").notNull(),
    totalErrors: integer("total_errors").notNull(),
    completed: integer("completed").notNull(),
    total: integer("total").notNull(),
    /**
     * 초성 힌트를 몇 번 봤는가. **순위의 첫 기준이다.**
     *
     * 한때 힌트를 시간에 30초씩 얹어 하나의 숫자로 만들었다. 그러면 화면의
     * 시간이 벽시계와 어긋나고, 그 30초의 무게가 코스 길이에 따라 널뛴다 —
     * 제주 두 곳에서는 판을 끝장내고 전국 229곳에서는 티도 안 났다.
     */
    hintsUsed: integer("hints_used").notNull().default(0),

    /**
     * 내린 기록.
     *
     * **지우지 않고 숨긴다.** 지우면 왜 지웠는지가 안 남고 잘못 눌렀을 때
     * 되돌릴 수 없다. 같은 기기가 되풀이하는지도 숨긴 것이 남아 있어야 보인다.
     *
     * 순위표와 등수 계산에서 함께 빠져야 한다. 한쪽만 빼면 `상위 8%`라고
     * 해 놓고 등록하면 다른 자리에 가 있게 된다.
     */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    /** 왜 내렸는가. 나중에 규칙으로 만들 수 있는 유일한 재료다. */
    hiddenReason: text("hidden_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 같은 세션 토큰으로는 한 번만 제출할 수 있다.
    uniqueIndex("scores_session_idx").on(t.sessionId),
    // 순위표는 코스+모드+채점버전으로 좁힌 뒤 타수순으로 읽는다.
    index("scores_leaderboard_idx").on(
      t.courseId,
      t.mode,
      t.scoringVersion,
      t.courseVersion,
      t.cpm,
    ),
    index("scores_device_idx").on(t.deviceId, t.createdAt),
  ],
);

export type ScoreRow = typeof scores.$inferSelect;
export type NewScoreRow = typeof scores.$inferInsert;

/**
 * 이용 흐름 계측.
 *
 * 개인을 식별하는 값은 담지 않는다. deviceId는 로그인 없이 한 사람의 여정을
 * 이어 보기 위한 익명 토큰이고, 그 밖에는 어떤 코스를 어디까지 했는지만 남는다.
 *
 * 알고 싶은 것은 하나다 — 사람들이 지도 회상의 부담 때문에 나가는가,
 * 아니면 그냥 흥미가 없어서 나가는가. 그래서 `게임 시작 → 첫 정답` 구간과
 * 진행도 0에서의 힌트 사용을 볼 수 있게 필드를 잡았다.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 클라이언트가 만든 이벤트 식별자. 같은 묶음이 두 번 와도 한 번만 센다. */
    eventId: text("event_id").unique(),
    name: text("name").notNull(),
    deviceId: text("device_id").notNull(),
    courseId: text("course_id"),
    mode: text("mode"),
    /** 판이 시작된 뒤 흐른 시간(ms). 묶어 보내느라 뭉개지는 created_at 대신 쓴다 */
    atMs: integer("at_ms"),
    /** 이 시점까지 확정한 항목 수 */
    progress: integer("progress"),
    total: integer("total"),
    elapsedMs: integer("elapsed_ms"),
    hintCount: integer("hint_count"),
    /** mode_switch에서 넘어간 목적지 모드 */
    toMode: text("to_mode"),
    /** game_start를 유발한 화면 */
    source: text("source"),
    /** 실험 버전. 다른 버전의 이벤트와 섞어서 해석하면 안 된다. */
    experiment: text("experiment"),
    /** 화면 판번호. 화면을 고치면서도 숫자를 가를 수 있게 한다. */
    revision: text("revision"),
    /** 한 판을 묶는 값. 퍼널의 분모를 사람·판 단위로 셀 수 있게 한다. */
    gameId: text("game_id"),
    /** 개발·QA와 봇. 분석에서 항상 제외한다(lib/analytics/bots.ts). */
    internal: boolean("internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_funnel_idx").on(t.experiment, t.courseId, t.mode, t.name, t.createdAt),
    index("events_device_idx").on(t.deviceId, t.createdAt),
    index("events_game_idx").on(t.gameId),
  ],
);

export type NewEventRow = typeof events.$inferInsert;

/**
 * 서버·브라우저에서 터진 오류.
 *
 * 로그로만 남기면 아무도 안 본다. 관측 기간에 숫자가 이상할 때 "사람들이
 * 안 하는 것"과 "터진 것"을 구분할 방법이 있어야 한다. 계측과 같은 곳에
 * 두면 같은 질의로 같이 볼 수 있다.
 *
 * 요청 본문이나 입력값은 절대 담지 않는다. 여기 필요한 것은 어디서 무엇이
 * 몇 번 터졌는가이지 누가 무엇을 쳤는가가 아니다.
 */
export const errors = pgTable(
  "errors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** server | client */
    source: text("source").notNull(),
    message: text("message").notNull(),
    /** React가 가려 놓은 오류를 로그와 맞춰 보는 열쇠 */
    digest: text("digest"),
    stack: text("stack"),
    /** 터진 자리. 주소의 질의 문자열은 떼고 경로만 남긴다 */
    path: text("path"),
    /** render | route | action 등 어떤 처리 중이었는지 */
    kind: text("kind"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("errors_recent_idx").on(t.createdAt)],
);

export type NewErrorRow = typeof errors.$inferInsert;
