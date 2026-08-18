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
  /** 힌트 페널티까지 포함한 경과 시간 */
  elapsedMs: number;
  totalErrors: number;
  /** 건너뛰지 않고 끝낸 항목 수 */
  completed: number;
  total: number;
  hintsUsed: number;
  /** 그중 elapsedMs에 얹힌 시간. 화면이 뺄셈을 보여 주는 데 쓴다. */
  hintPenaltyMs: number;
  /** 첫 제출에 맞힌 항목 수 */
  firstTry: number;
}

export function computeScore(inputs: ScoreInputs): Score {
  const correct = Math.max(0, inputs.correctKeystrokes);
  const firstTry = Math.max(0, inputs.firstTry);
  return {
    cpm: cpm(correct, inputs.elapsedMs),
    /*
     * 정확도는 **곳 기준**이다 — 끝낸 곳 중 한 번에 맞힌 비율.
     *
     * 한때 타수 기준이었다(맞은 타수 ÷ 제출한 타수). 그러면 긴 이름을 틀린
     * 것이 짧은 이름을 틀린 것보다 더 깎이는데, 이 게임에서 `서귀포시`를
     * 틀린 것이 `중구`를 틀린 것보다 나쁠 이유가 없다. 이 게임의 단위는
     * 타수가 아니라 곳이다.
     *
     * 분모는 끝낸 곳이다. 건너뛴 곳은 이미 완주 수에서 빠졌으므로 여기서 또
     * 세면 같은 일로 두 번 벌하는 셈이다. 하나도 끝내지 못한 판은 정의할 수
     * 없으므로 1로 둔다 — 0%로 두면 시작만 하고 나간 사람이 순위표 맨 아래에
     * 0%로 남는다.
     */
    accuracy:
      inputs.completed === 0 ? 1 : Math.min(1, firstTry / inputs.completed),
    elapsedMs: inputs.elapsedMs,
    correctKeystrokes: correct,
    totalErrors: inputs.totalErrors,
    completed: inputs.completed,
    total: inputs.total,
    hintsUsed: inputs.hintsUsed,
    hintPenaltyMs: Math.max(0, inputs.hintPenaltyMs),
    firstTry,
  };
}
