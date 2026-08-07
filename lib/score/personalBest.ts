import { readJson, writeJson } from "../storage";
import type { ModeId, Score } from "../game/types";
import { SCORING_VERSION } from "./version";

/**
 * 개인 최고 기록.
 *
 * 랭킹 1등은 대부분 못 하지만 어제의 나는 매번 이길 수 있다. 이 게임을 다시
 * 켜게 만드는 건 이쪽이라, 로그인 없이도 되도록 기기에 남긴다.
 */
export interface PersonalBest {
  courseId: string;
  mode: ModeId;
  cpm: number;
  accuracy: number;
  elapsedMs: number;
  completed: number;
  total: number;
  hintsUsed: number;
  /** 채점 규칙이 바뀌면 옛 기록과 비교할 수 없다. */
  scoringVersion: number;
  achievedAt: number;
}

/**
 * 비교 가능성을 정하는 세 축을 키에 모두 넣는다 —
 * 채점 규칙(s), 코스 판번호(c), 그리고 코스·모드.
 * 어느 하나라도 바뀌면 옛 기록이 자동으로 비교 대상에서 빠진다.
 */
function keyOf(courseId: string, mode: ModeId, courseVersion: number): string {
  return `sigun:pb:s${SCORING_VERSION}:c${courseVersion}:${mode}:${courseId}`;
}

/**
 * 어느 쪽이 더 나은 기록인가.
 *
 * 모드마다 목표가 다르지만 한 규칙으로 덮인다 — 많이 끝낸 쪽이 먼저다.
 * 타임어택은 시간이 고정이라 완주 수가 곧 실력이고, 시간 제한이 없는 모드에서는
 * 대개 둘 다 완주하므로 그다음 기준인 시간이 승부를 가른다.
 * 건너뛴 판이 완주한 판을 이기는 일은 이 순서 덕분에 생기지 않는다.
 */
export function isBetter(candidate: Score, current: PersonalBest): boolean {
  if (candidate.completed !== current.completed) {
    return candidate.completed > current.completed;
  }
  if (candidate.elapsedMs !== current.elapsedMs) {
    return candidate.elapsedMs < current.elapsedMs;
  }
  return candidate.accuracy > current.accuracy;
}

export function toRecord(
  courseId: string,
  mode: ModeId,
  score: Score,
  now: number,
): PersonalBest {
  return {
    courseId,
    mode,
    cpm: score.cpm,
    accuracy: score.accuracy,
    elapsedMs: score.elapsedMs,
    completed: score.completed,
    total: score.total,
    hintsUsed: score.hintsUsed,
    scoringVersion: SCORING_VERSION,
    achievedAt: now,
  };
}

export function loadPersonalBest(
  courseId: string,
  mode: ModeId,
  courseVersion: number,
): PersonalBest | null {
  return readJson(keyOf(courseId, mode, courseVersion), (raw) => {
    const parsed = raw as PersonalBest | null;
    // 손으로 고쳤거나 옛 버전이면 없는 것으로 본다.
    if (parsed?.scoringVersion !== SCORING_VERSION) return null;
    if (typeof parsed.elapsedMs !== "number") return null;
    return parsed;
  });
}

/**
 * 더 나은 기록이면 저장한다. 아무것도 끝내지 못한 판은 기록으로 남기지 않는다.
 * @returns 새 기록으로 갱신되었는지
 */
export function savePersonalBest(
  courseId: string,
  mode: ModeId,
  score: Score,
  now: number,
  courseVersion: number,
): boolean {
  if (score.completed === 0) return false;

  const previous = loadPersonalBest(courseId, mode, courseVersion);
  if (previous && !isBetter(score, previous)) return false;

  // 쓰기가 막힌 환경(사생활 보호 모드 등)에서는 false가 돌아온다.
  // 기록을 못 남기는 것일 뿐, 게임을 막을 이유는 아니다.
  return writeJson(
    keyOf(courseId, mode, courseVersion),
    toRecord(courseId, mode, score, now),
  );
}
