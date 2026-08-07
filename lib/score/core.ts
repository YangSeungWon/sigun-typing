import { cpm } from "../hangul/keystrokes";
import type { Score } from "../game/types";

/**
 * 점수를 만드는 단 하나의 규칙.
 *
 * 이 계산은 두 곳에서 일어난다 — 브라우저가 화면에 띄우는 값과, 서버가 타건
 * 기록을 재생해 다시 구하는 값이다. 둘이 어긋나면 정직하게 친 사람의 기록이
 * `score_mismatch`로 거부된다. 그래서 규칙은 여기 한 벌만 두고, 양쪽은 재료만
 * 모아서 넘긴다.
 *
 * 재료를 어디서 얻는지는 각자 다르다. 브라우저는 진행 중인 상태에서, 서버는
 * 제출된 타건 기록에서 얻는다. 그 차이는 남기고, 규칙만 공유한다.
 */
export interface ScoreInputs {
  /** 정답으로 인정된 타수 */
  correctKeystrokes: number;
  /** 실제로 친 타수. 정확도의 분모다 */
  typedKeystrokes: number;
  /** 힌트 페널티까지 포함한 경과 시간 */
  elapsedMs: number;
  totalErrors: number;
  /** 건너뛰지 않고 끝낸 항목 수 */
  completed: number;
  total: number;
  hintsUsed: number;
}

export function computeScore(inputs: ScoreInputs): Score {
  const typed = Math.max(0, inputs.typedKeystrokes);
  const correct = Math.max(0, inputs.correctKeystrokes);
  return {
    cpm: cpm(correct, inputs.elapsedMs),
    // 한 타도 안 친 판은 정확도를 정의할 수 없다. 0%로 두면 시작만 하고 나간
    // 사람이 순위표 맨 아래에 0%로 남는다.
    accuracy: typed === 0 ? 1 : Math.min(1, correct / typed),
    elapsedMs: inputs.elapsedMs,
    correctKeystrokes: correct,
    totalErrors: inputs.totalErrors,
    completed: inputs.completed,
    total: inputs.total,
    hintsUsed: inputs.hintsUsed,
  };
}
