import { and, asc, count, desc, eq, gt, gte, lte } from "drizzle-orm";
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
   * 이 기록이 지금 어디쯤인가. 순위표와 **같은 기준(타수 내림차순)** 이어야 한다.
   * 기준이 갈리면 "상위 8%"라고 해 놓고 등록하면 다른 자리에 가 있게 된다.
   */
  standing(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    cpm: number,
  ): Promise<{ better: number; total: number }>;
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
    cpm: number,
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
      .sort((a, b) => b.cpm - a.cpm)
      .slice(0, limit)
      .map(toEntry);
  }

  async standing(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    cpm: number,
  ) {
    const pool = this.rows.filter(
      (r) =>
        r.courseId === courseId &&
        r.mode === mode &&
        r.scoringVersion === scoringVersion &&
        r.courseVersion === courseVersion,
    );
    return { better: pool.filter((r) => r.cpm > cpm).length, total: pool.length };
  }

  async neighbors(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    cpm: number,
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
      .sort((a, b) => b.cpm - a.cpm);
    return {
      above: pool.filter((r) => r.cpm > cpm).slice(-span).map(toEntry),
      below: pool.filter((r) => r.cpm <= cpm).slice(0, span).map(toEntry),
    };
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
      .orderBy(desc(scores.cpm))
      .limit(limit);
    return rows.map(toEntry);
  }

  async standing(
    courseId: string,
    mode: ModeId,
    scoringVersion: number,
    courseVersion: number,
    cpm: number,
  ) {
    const scope = and(
      eq(scores.courseId, courseId),
      eq(scores.mode, mode),
      eq(scores.scoringVersion, scoringVersion),
      eq(scores.courseVersion, courseVersion),
    );
    const [totalRow, betterRow] = await Promise.all([
      this.db.select({ n: count() }).from(scores).where(scope),
      this.db
        .select({ n: count() })
        .from(scores)
        .where(and(scope, gt(scores.cpm, cpm))),
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
    cpm: number,
    span: number,
  ) {
    const scope = and(
      eq(scores.courseId, courseId),
      eq(scores.mode, mode),
      eq(scores.scoringVersion, scoringVersion),
      eq(scores.courseVersion, courseVersion),
    );
    const [above, below] = await Promise.all([
      // 나보다 나은 기록 중 가장 가까운 쪽. 오름차순으로 뽑아야 바로 위가 나온다.
      this.db.select().from(scores).where(and(scope, gt(scores.cpm, cpm)))
        .orderBy(asc(scores.cpm)).limit(span),
      this.db.select().from(scores).where(and(scope, lte(scores.cpm, cpm)))
        .orderBy(desc(scores.cpm)).limit(span),
    ]);
    return { above: above.reverse().map(toEntry), below: below.map(toEntry) };
  }

  async recordError(row: NewErrorRow) {
    await this.db.insert(errors).values(row);
  }
}
