import { readJson, remove, writeJson } from "../storage";
import type { ItemResult } from "../game/types";
import { classifyWrongAnswer, type PeerName } from "./confusion";

/**
 * 오답노트.
 *
 * 이 게임을 타자 게임이 아니라 지리 암기 게임으로 만드는 조각이다.
 * 틀린 곳을 기억해 두었다가 그것만 다시 물어봐야 실제로 외워진다.
 *
 * 채점 규칙 버전과 엮지 않는다 — 이건 점수가 아니라 학습 상태라,
 * 타수 계산법이 바뀌어도 "안양을 세 번 틀렸다"는 사실은 그대로 유효하다.
 */
/*
 * `confusedWith`가 나중에 들어왔는데도 1로 둔다.
 *
 * 저장 형식의 판번호를 올린다는 것은 "옛 값을 못 본 척한다"는 뜻이다
 * (`lib/storage.ts` 참조). 그 규칙은 옛 값이 **틀린 값이 되었을 때**를 위한
 * 것이고, 여기서는 옛 기록이 더 가난할 뿐 여전히 맞다. 올리면 모두의
 * 오답노트를 버리면서 얻는 것이 없다 — 필드는 다음 오답 때 저절로 붙는다.
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
  /**
   * 이 지역을 무엇으로 착각했는가. 상대 이름 → 횟수.
   *
   * 코드가 아니라 이름으로 담는다. 제출된 값이 이름이고, 코드로 되돌리려면
   * 오답노트가 코스 데이터를 알아야 하는데 이 파일은 지금까지 그것을 몰랐다.
   * 몰라도 되는 것을 알게 만들면서까지 얻을 값이 아니다.
   *
   * 옛 기록에는 없다. 그래서 선택 항목이고, SCHEMA_VERSION도 올리지 않는다 —
   * 아래 참조.
   */
  confusedWith?: Record<string, number>;
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

/**
 * 아직 헷갈리는 곳이 먼저, 그 다음 자주 틀린 순, 같으면 최근에 틀린 순.
 *
 * 한 번 맞혀 둔 곳(거의 외운 곳)을 목록 맨 위에 두면, 정작 다시 봐야 할
 * 곳이 아래로 밀린다.
 */
export function sortByPriority(records: MistakeRecord[]): MistakeRecord[] {
  return [...records].sort(
    (a, b) =>
      a.cleanStreak - b.cleanStreak ||
      b.misses - a.misses ||
      b.lastMissedAt - a.lastMissedAt,
  );
}

/**
 * 이 판에서 제출된 오답 중 **다른 지역과 착각한 것**만 골라 세어 더한다.
 * 오타는 여기서 걸러진다(`classifyWrongAnswer`).
 */
function tallyConfusions(
  existing: Record<string, number> | undefined,
  result: ItemResult,
  peers: PeerName[],
): Record<string, number> | undefined {
  if (peers.length === 0 || !result.wrongAnswers?.length) return existing;

  let next: Record<string, number> | undefined;
  for (const wrong of result.wrongAnswers) {
    const other = classifyWrongAnswer(wrong, result.answer, peers);
    if (!other) continue;
    next ??= { ...existing };
    next[other] = (next[other] ?? 0) + 1;
  }

  return next ?? existing;
}

/**
 * 한 판의 결과를 오답노트에 반영한 결과를 돌려준다.
 * 저장과 분리해 두어야 규칙을 테스트할 수 있다.
 *
 * `peers`는 같은 코스의 다른 지역 이름들이다. 비어 있으면 상대를 알 수 없으므로
 * 혼동을 한 건도 쌓지 않는다 — 기본값을 그렇게 둔 덕에 옛 호출부가 그대로
 * 컴파일되고, 모르면 안 적는다는 규칙이 기본이 된다.
 */
export function applyRun(
  existing: MistakeRecord[],
  results: ItemResult[],
  now: number,
  peers: PeerName[] = [],
): MistakeRecord[] {
  const byCode = new Map(existing.map((r) => [r.code, { ...r }]));

  for (const result of results) {
    const current = byCode.get(result.id);

    if (isMiss(result)) {
      const confusedWith = tallyConfusions(current?.confusedWith, result, peers);
      byCode.set(result.id, {
        code: result.id,
        name: result.answer,
        misses: (current?.misses ?? 0) + 1,
        cleanStreak: 0,
        lastMissedAt: now,
        ...(confusedWith ? { confusedWith } : {}),
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

/*
 * `peers`를 여기서 코스 데이터로 직접 풀지 않고 부르는 쪽에서 받는다.
 *
 * 이 파일이 `@/data/courses`를 import하는 순간 오답노트를 읽기만 하는 화면까지
 * 245개 지역 배열을 함께 내려받게 된다. 첫 화면이 바로 그런 화면이다.
 * 지역 목록을 이미 손에 들고 있는 곳(게임)에서 넘기면 그 값을 치르지 않는다.
 */
export function saveRun(
  courseId: string,
  results: ItemResult[],
  now: number,
  peers: PeerName[] = [],
) {
  const next = applyRun(loadMistakes(courseId), results, now, peers);
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
