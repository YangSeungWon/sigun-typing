import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ModeId } from "../game/types";
import {
  errors,
  events,
  scores,
  type NewErrorRow,
  type NewScoreRow,
  type ScoreRow,
} from "./schema";
import type { GameEvent } from "../analytics/events";

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  cpm: number;
  accuracy: number;
  elapsedMs: number;
  completed: number;
  total: number;
  createdAt: Date;
}

/**
 * 순위를 매기는 기준.
 *
 * **많이 끝낸 쪽이 먼저, 같으면 빠른 쪽이 먼저.** 개인 기록이 이미 쓰던
 * 규칙이고(lib/score/personalBest.ts) 이제 순위표도 같은 것을 쓴다.
 *
 * 한때 타수(cpm) 내림차순이었다. 정확도를 제출 기준으로 바꾸면서 맞힌 타수가
 * "완주한 지역들의 이름 길이 합"으로 고정됐고, 코스를 다 돌면 그 값은 상수라
 * 타수 순위가 곧 시간 순위가 됐다 — 같은 말을 두 번 하는 셈이었다. 게다가
 * 개인 기록과 순위표가 서로 다른 기준을 쓰고 있었다.
 */
export interface RankKey {
  completed: number;
  elapsedMs: number;
}

/** a가 b보다 나은 기록인가. */
export function outranks(a: RankKey, b: RankKey): boolean {
  if (a.completed !== b.completed) return a.completed > b.completed;
  return a.elapsedMs < b.elapsedMs;
}

export interface ScoreRepository {
  /** 이미 제출된 세션이면 false. 중복 제출을 막는다. */
  insert(row: NewScoreRow): Promise<boolean>;
  /**
   * 순위표. 채점 규칙 버전이 다른 기록은 비교할 수 없으므로 섞지 않는다.
   * @param since 이 시각 이후 기록만. null이면 전체 기간.
   */
  leaderboard(
    courseId: string,
    mode: ModeId,
    limit: number,
    scoringVersion: number,
    courseVersion: number,
    since?: Date | null,
  ): Promise<LeaderboardEntry[]>;
  /**
   * 이 기록이 지금 어디쯤인가. 순위표와 **같은 기준**이어야 한다.
   * 기준이 갈리면 "상위 8%"라고 해 놓고 등록하면 다른 자리에 가 있게 된다.
   */
  standing(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    key: RankKey,
  ): Promise<{ better: number; total: number }>;
  /**
   * 코스마다 1위 기록 하나씩.
   *
   * 첫 화면의 카드에 붙는다. 처음 온 사람에게는 "이 코스는 이 정도 걸린다"는
   * 감이 되고, 해 본 사람에게는 목표가 된다. 열일곱 번 물어보지 않도록 한
   * 번에 가져온다.
   */
  bests(
    courses: { courseId: string; courseVersion: number }[],
    mode: ModeId,
    scoringVersion: number,
  ): Promise<Map<string, LeaderboardEntry>>;
  /** 최근 `windowMs` 안에 이 기기가 제출한 횟수 */
  recentCount(deviceId: string, windowMs: number, now: number): Promise<number>;
  /** 익명 이용 흐름 기록 */
  recordEvents(deviceId: string, batch: GameEvent[]): Promise<void>;
  /**
   * 내 기록 언저리의 몇 줄.
   *
   * 상위 10명만 보면 신규 사용자는 아무 감정이 없다 — 1위가 18초, 나는 2분.
   * 바로 위와 바로 아래가 보여야 따라잡을 마음이 생긴다.
   */
  neighbors(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    key: RankKey,
    span: number,
  ): Promise<{ above: LeaderboardEntry[]; below: LeaderboardEntry[] }>;
  /** 오류 기록. 이걸 남기다 실패해도 호출한 쪽이 죽으면 안 된다. */
  recordError(row: NewErrorRow): Promise<void>;
}

function toEntry(row: ScoreRow): LeaderboardEntry {
  return {
    id: row.id,
    nickname: row.nickname,
    cpm: row.cpm,
    accuracy: row.accuracy,
    elapsedMs: row.elapsedMs,
    completed: row.completed,
    total: row.total,
    createdAt: row.createdAt,
  };
}

/**
 * DATABASE_URL이 없을 때 쓰는 구현. 로컬 개발과 테스트용이며 프로세스가 죽으면
 * 사라진다. 운영에서 이걸로 뜨면 랭킹이 조용히 증발하므로 client.ts에서 경고한다.
 */
export class MemoryScoreRepository implements ScoreRepository {
  private rows: ScoreRow[] = [];
  private sessions = new Set<string>();

  async insert(row: NewScoreRow): Promise<boolean> {
    if (this.sessions.has(row.sessionId)) return false;
    this.sessions.add(row.sessionId);
    this.rows.push({
      id: crypto.randomUUID(),
      createdAt: new Date(),
      scoringVersion: 1,
      courseVersion: 1,
      ...row,
    } as ScoreRow);
    return true;
  }

  async leaderboard(
    courseId: string,
    mode: ModeId,
    limit: number,
    scoringVersion: number,
    courseVersion: number,
    since?: Date | null,
  ) {
    return this.rows
      .filter(
        (r) =>
          r.courseId === courseId &&
          r.mode === mode &&
          r.scoringVersion === scoringVersion &&
          r.courseVersion === courseVersion &&
          (!since || r.createdAt >= since),
      )
      .sort((a, b) => (outranks(a, b) ? -1 : outranks(b, a) ? 1 : 0))
      .slice(0, limit)
      .map(toEntry);
  }

  async standing(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    key: RankKey,
  ) {
    const pool = this.rows.filter(
      (r) =>
        r.courseId === courseId &&
        r.mode === mode &&
        r.scoringVersion === scoringVersion &&
        r.courseVersion === courseVersion,
    );
    return { better: pool.filter((r) => outranks(r, key)).length, total: pool.length };
  }

  async neighbors(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    key: RankKey,
    span: number,
  ) {
    const pool = this.rows
      .filter(
        (r) =>
          r.courseId === courseId &&
          r.mode === mode &&
          r.scoringVersion === scoringVersion &&
          r.courseVersion === courseVersion,
      )
      .sort((a, b) => (outranks(a, b) ? -1 : outranks(b, a) ? 1 : 0));
    return {
      above: pool.filter((r) => outranks(r, key)).slice(-span).map(toEntry),
      below: pool.filter((r) => !outranks(r, key)).slice(0, span).map(toEntry),
    };
  }

  async bests(
    courses: { courseId: string; courseVersion: number }[],
    mode: ModeId,
    scoringVersion: number,
  ) {
    const best = new Map<string, LeaderboardEntry>();
    for (const { courseId, courseVersion } of courses) {
      const top = this.rows
        .filter(
          (r) =>
            r.courseId === courseId &&
            r.mode === mode &&
            r.scoringVersion === scoringVersion &&
            r.courseVersion === courseVersion,
        )
        .sort((a, b) => (outranks(a, b) ? -1 : outranks(b, a) ? 1 : 0))[0];
      if (top) best.set(courseId, toEntry(top));
    }
    return best;
  }

  async recentCount(deviceId: string, windowMs: number, now: number) {
    const since = now - windowMs;
    return this.rows.filter(
      (r) => r.deviceId === deviceId && r.createdAt.getTime() >= since,
    ).length;
  }

  /** 메모리 저장소에서는 계측을 버린다. 개발 중에 볼 이유가 없다. */
  async recordEvents() {}

  /** 오류는 버리지 않는다 — 로그로는 이미 나갔고, 여기서는 셀 수만 있으면 된다. */
  private errorRows: NewErrorRow[] = [];
  async recordError(row: NewErrorRow) {
    this.errorRows.push(row);
  }
  /** 테스트에서 몇 건이 들어왔는지 보기 위한 것. */
  recordedErrors(): NewErrorRow[] {
    return this.errorRows;
  }
}

export class PostgresScoreRepository implements ScoreRepository {
  constructor(private db: PostgresJsDatabase) {}

  async insert(row: NewScoreRow): Promise<boolean> {
    // 세션 유니크 인덱스가 중복을 막는다. 충돌하면 아무 행도 돌아오지 않는다.
    const inserted = await this.db
      .insert(scores)
      .values(row)
      .onConflictDoNothing()
      .returning();
    return inserted.length > 0;
  }

  async leaderboard(
    courseId: string,
    mode: ModeId,
    limit: number,
    scoringVersion: number,
    courseVersion: number,
    since?: Date | null,
  ) {
    const rows = await this.db
      .select()
      .from(scores)
      .where(
        and(
          eq(scores.courseId, courseId),
          eq(scores.mode, mode),
          eq(scores.scoringVersion, scoringVersion),
          eq(scores.courseVersion, courseVersion),
          ...(since ? [gte(scores.createdAt, since)] : []),
        ),
      )
      .orderBy(desc(scores.completed), asc(scores.elapsedMs))
      .limit(limit);
    return rows.map(toEntry);
  }

  async standing(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    key: RankKey,
  ) {
    const scope = and(
      eq(scores.courseId, courseId),
      eq(scores.mode, mode),
      eq(scores.scoringVersion, scoringVersion),
      eq(scores.courseVersion, courseVersion),
    );
    // 나보다 나은 기록 — 더 많이 끝냈거나, 같은 수를 더 빨리 끝낸 기록.
    const better = sql`(${scores.completed} > ${key.completed} or (${scores.completed} = ${key.completed} and ${scores.elapsedMs} < ${key.elapsedMs}))`;
    const [totalRow, betterRow] = await Promise.all([
      this.db.select({ n: count() }).from(scores).where(scope),
      this.db.select({ n: count() }).from(scores).where(and(scope, better)),
    ]);
    return {
      better: Number(betterRow[0]?.n ?? 0),
      total: Number(totalRow[0]?.n ?? 0),
    };
  }

  async recentCount(deviceId: string, windowMs: number, now: number) {
    const since = new Date(now - windowMs);
    // gte()를 쓰는 이유: sql 템플릿에 Date를 그대로 넣으면 드라이버가 타입을 몰라
    // 런타임에 터진다. 컬럼 타입을 아는 연산자에 맡긴다.
    const rows = await this.db
      .select({ n: count() })
      .from(scores)
      .where(and(eq(scores.deviceId, deviceId), gte(scores.createdAt, since)));
    return Number(rows[0]?.n ?? 0);
  }

  async recordEvents(deviceId: string, batch: GameEvent[]) {
    await this.db
      .insert(events)
      .values(
        batch.map((e) => ({
          eventId: e.id,
          name: e.name,
          deviceId,
          courseId: e.courseId,
          mode: e.mode,
          atMs: e.atMs,
          progress: e.progress,
          total: e.total,
          elapsedMs: e.elapsedMs,
          hintCount: e.hintCount,
          toMode: e.toMode,
          source: e.source,
          experiment: e.experiment,
          revision: e.revision,
          gameId: e.gameId,
          internal: e.internal ?? false,
        })),
      )
      // 같은 이벤트가 두 번 도착하면 버린다. beacon은 도착 확인이 불가능하고,
      // 중복이 그대로 쌓이면 판 수가 부풀어 퍼널이 조용히 틀린다.
      .onConflictDoNothing({ target: events.eventId });
  }

  async neighbors(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    key: RankKey,
    span: number,
  ) {
    const scope = and(
      eq(scores.courseId, courseId),
      eq(scores.mode, mode),
      eq(scores.scoringVersion, scoringVersion),
      eq(scores.courseVersion, courseVersion),
    );
    const better = sql`(${scores.completed} > ${key.completed} or (${scores.completed} = ${key.completed} and ${scores.elapsedMs} < ${key.elapsedMs}))`;
    const [above, below] = await Promise.all([
      // 나보다 나은 기록 중 가장 가까운 쪽. 거꾸로 뽑아야 바로 위가 나온다.
      this.db.select().from(scores).where(and(scope, better))
        .orderBy(asc(scores.completed), desc(scores.elapsedMs)).limit(span),
      this.db.select().from(scores).where(and(scope, sql`not ${better}`))
        .orderBy(desc(scores.completed), asc(scores.elapsedMs)).limit(span),
    ]);
    return { above: above.reverse().map(toEntry), below: below.map(toEntry) };
  }

  async bests(
    courses: { courseId: string; courseVersion: number }[],
    mode: ModeId,
    scoringVersion: number,
  ) {
    const best = new Map<string, LeaderboardEntry>();
    if (courses.length === 0) return best;

    /*
     * 코스마다 한 줄씩. DISTINCT ON은 정렬의 첫 줄만 남기므로, 순위 기준
     * 그대로 정렬해 두면 그게 곧 1위다.
     *
     * 코스별 판번호가 다르므로 (코스, 판번호) 짝으로 걸러야 한다 — 코스 하나가
     * 바뀌었을 때 옛 판의 기록이 새 판의 1위로 올라오면 안 된다.
     */
    const pairs = sql.join(
      courses.map(
        (c) => sql`(${scores.courseId} = ${c.courseId} and ${scores.courseVersion} = ${c.courseVersion})`,
      ),
      sql` or `,
    );
    const rows = await this.db
      .select()
      .from(scores)
      .where(
        and(
          eq(scores.mode, mode),
          eq(scores.scoringVersion, scoringVersion),
          sql`(${pairs})`,
        ),
      )
      .orderBy(desc(scores.completed), asc(scores.elapsedMs));

    for (const row of rows) {
      if (!best.has(row.courseId)) best.set(row.courseId, toEntry(row));
    }
    return best;
  }

  async recordError(row: NewErrorRow) {
    await this.db.insert(errors).values(row);
  }
}
