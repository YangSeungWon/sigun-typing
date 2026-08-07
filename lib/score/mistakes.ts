import { readJson, remove, writeJson } from "../storage";
import type { ItemResult } from "../game/types";

/**
 * 오답노트.
 *
 * 이 게임을 타자 게임이 아니라 지리 암기 게임으로 만드는 조각이다.
 * 틀린 곳을 기억해 두었다가 그것만 다시 물어봐야 실제로 외워진다.
 *
 * 채점 규칙 버전과 엮지 않는다 — 이건 점수가 아니라 학습 상태라,
 * 타수 계산법이 바뀌어도 "안양을 세 번 틀렸다"는 사실은 그대로 유효하다.
 */
const SCHEMA_VERSION = 1;

export interface MistakeRecord {
  code: string;
  name: string;
  /** 총 틀린 횟수 */
  misses: number;
  /** 연속으로 깨끗하게 맞힌 횟수 */
  cleanStreak: number;
  lastMissedAt: number;
}

/** 이만큼 연속으로 깨끗하게 맞히면 오답노트에서 빠진다. */
export const GRADUATE_STREAK = 2;

function keyOf(courseId: string): string {
  return `sigun:miss:v${SCHEMA_VERSION}:${courseId}`;
}

/**
 * 이 항목을 "몰랐다"고 볼 것인가.
 *
 * 오타·건너뛰기·힌트 셋 다 몰랐다는 신호다. 특히 힌트는 답을 맞혔더라도
 * 초성을 봐야 했다는 뜻이므로 오답으로 센다. 그러지 않으면 힌트로 넘긴 지역이
 * 영영 오답노트에 들어오지 않는다.
 */
export function isMiss(result: ItemResult): boolean {
  return result.skipped || result.errors > 0 || result.hinted;
}

export function loadMistakes(courseId: string): MistakeRecord[] {
  return (
    readJson(keyOf(courseId), (raw) => {
      if (!Array.isArray(raw)) return null;
      return (raw as MistakeRecord[]).filter(
        (r) => typeof r?.code === "string" && r.misses > 0,
      );
    }) ?? []
  );
}

/** 자주 틀린 순, 같으면 최근에 틀린 순. */
export function sortByPriority(records: MistakeRecord[]): MistakeRecord[] {
  return [...records].sort(
    (a, b) => b.misses - a.misses || b.lastMissedAt - a.lastMissedAt,
  );
}

/**
 * 한 판의 결과를 오답노트에 반영한 결과를 돌려준다.
 * 저장과 분리해 두어야 규칙을 테스트할 수 있다.
 */
export function applyRun(
  existing: MistakeRecord[],
  results: ItemResult[],
  now: number,
): MistakeRecord[] {
  const byCode = new Map(existing.map((r) => [r.code, { ...r }]));

  for (const result of results) {
    const current = byCode.get(result.id);

    if (isMiss(result)) {
      byCode.set(result.id, {
        code: result.id,
        name: result.answer,
        misses: (current?.misses ?? 0) + 1,
        cleanStreak: 0,
        lastMissedAt: now,
      });
      continue;
    }

    // 오답노트에 없던 곳을 맞힌 것은 기록할 필요가 없다.
    if (!current) continue;

    const cleanStreak = current.cleanStreak + 1;
    if (cleanStreak >= GRADUATE_STREAK) byCode.delete(result.id);
    else byCode.set(result.id, { ...current, cleanStreak });
  }

  return sortByPriority([...byCode.values()]);
}

export function saveRun(courseId: string, results: ItemResult[], now: number) {
  const next = applyRun(loadMistakes(courseId), results, now);
  // 남은 오답이 없으면 키째로 지운다. 빈 배열을 남기면 "아직 안 풀어 봄"과
  // "다 졸업함"이 구분되지 않는다.
  if (next.length === 0) remove(keyOf(courseId));
  else writeJson(keyOf(courseId), next);
}

export function clearMistakes(courseId: string) {
  remove(keyOf(courseId));
}

/** 모든 코스의 오답을 모아 온다. 오답노트 화면에서 쓴다. */
export function loadAllMistakes(
  courseIds: string[],
): { courseId: string; records: MistakeRecord[] }[] {
  return courseIds
    .map((courseId) => ({ courseId, records: loadMistakes(courseId) }))
    .filter((entry) => entry.records.length > 0);
}
