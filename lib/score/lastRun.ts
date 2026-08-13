import { readJson, writeJson } from "../storage";
import type { ModeId } from "../game/types";

/**
 * 마지막으로 끝낸 판.
 *
 * 첫 화면의 `이어하기`가 어디를 가리킬지 정하는 값이다. 개인 기록으로 대신할 수
 * 없다 — `PersonalBest.achievedAt`은 기록이 **좋아졌을 때만** 갱신되므로
 * "언제 잘했나"에 답하지 "방금 뭘 했나"에 답하지 않는다. 어제 경기도를 세 판
 * 했는데 셋 다 지난달 기록을 못 넘겼다면, 그 값만 보고는 지난달에 한 서울로
 * 데려가게 된다.
 *
 * 코스별로 열일곱 개를 두지 않는다. 묻는 것이 하나("직전에 뭘 했나")라
 * 값도 하나면 된다.
 */
const KEY = "sigun:last:v1";

export interface LastRun {
  courseId: string;
  mode: ModeId;
  at: number;
}

/**
 * 모양만 검사한다. 저장된 courseId가 지금도 실재하는 코스인지는 여기서 모른다 —
 * 그것을 알려면 코스 데이터를 알아야 하고, 이 층은 그것을 모르는 채로 둔다.
 * 실재 여부는 이 값을 쓰는 쪽이 자기 목록과 대조해서 판단한다.
 */
export function loadLastRun(): LastRun | null {
  return readJson(KEY, (raw) => {
    const parsed = raw as LastRun | null;
    if (typeof parsed?.courseId !== "string" || parsed.courseId.length === 0) return null;
    if (typeof parsed.mode !== "string") return null;
    if (typeof parsed.at !== "number") return null;
    return parsed;
  });
}

export function saveLastRun(courseId: string, mode: ModeId, now: number): boolean {
  return writeJson(KEY, { courseId, mode, at: now } satisfies LastRun);
}
