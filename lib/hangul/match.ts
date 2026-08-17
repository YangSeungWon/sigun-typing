import { decompose, decomposeChar } from "./jamo.ts";
import { isKeystrokePrefix } from "./keystrokes.ts";

export type CharStatus =
  /** 목표 글자가 모두 입력됨 */
  | "correct"
  /** 오타 */
  | "wrong"
  /** 조합 중 — 아직 목표 글자로 가는 길 위에 있음 */
  | "pending"
  /** 아직 입력되지 않음 */
  | "untyped";

export interface MatchResult {
  /** target 글자 수만큼의 상태 배열 */
  statuses: CharStatus[];
  /** 목표 타수를 넘겨 입력된 타수 */
  overflow: number;
  /** 목표와 일치하는 타수 — 정확도 계산용 */
  matched: number;
  /** 지금까지 오타가 없음 (조합 중은 허용) */
  clean: boolean;
  /** 완전히 일치 */
  complete: boolean;
}

/**
 * 목표와 입력을 **자모 단위**로 대조한 뒤 글자 단위 상태로 되돌린다.
 *
 * 글자 단위로 비교하면 안 되는 이유: `고성`을 칠 때 입력은 고 → 곳 → 고서 → 고성을
 * 거친다. `곳`은 첫 글자 `고`와 다르지만 오타가 아니다 — 받침 ㅅ이 다음 음절의
 * 초성으로 옮겨가는 중일 뿐이다. 자모열 ㄱㅗㅅ은 ㄱㅗㅅㅓㅇ의 접두사이므로
 * 이 함수는 `고`를 correct, `성`을 pending으로 판정한다.
 */
export function matchProgress(target: string, typed: string): MatchResult {
  const targetChars = [...target];

  // 각 자모가 어느 글자에서 왔는지 기억해 둔다.
  const targetJamos: string[] = [];
  const owner: number[] = [];
  targetChars.forEach((ch, ci) => {
    for (const jamo of decomposeChar(ch)) {
      targetJamos.push(jamo);
      owner.push(ci);
    }
  });

  const typedJamos = decompose(typed);
  const matchedPerChar = new Array(targetChars.length).fill(0);
  const totalPerChar = new Array(targetChars.length).fill(0);
  const badChar = new Array(targetChars.length).fill(false);
  owner.forEach((ci) => totalPerChar[ci]++);

  let matched = 0;
  let errored = false;
  const compared = Math.min(targetJamos.length, typedJamos.length);
  for (let i = 0; i < compared; i++) {
    const ci = owner[i];
    if (!errored && typedJamos[i] === targetJamos[i]) {
      matchedPerChar[ci]++;
      matched++;
    } else {
      errored = true;
      badChar[ci] = true;
    }
  }

  const overflow = Math.max(0, typedJamos.length - targetJamos.length);
  if (overflow > 0 && targetChars.length > 0) {
    badChar[targetChars.length - 1] = true;
  }

  const statuses: CharStatus[] = targetChars.map((_, ci) => {
    if (badChar[ci]) return "wrong";
    if (matchedPerChar[ci] === totalPerChar[ci]) return "correct";
    if (matchedPerChar[ci] > 0) return "pending";
    return "untyped";
  });

  return {
    statuses,
    overflow,
    matched,
    clean: !errored && overflow === 0,
    complete: typed === target,
  };
}

/** 입력 전체가 목표의 타건 접두사인지 — 진행 중 정답 여부 판정용. */
export function isOnTrack(target: string, typed: string): boolean {
  return isKeystrokePrefix(typed, target);
}
