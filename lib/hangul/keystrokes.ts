import { decompose, decomposeChar } from "./jamo";

/**
 * 두벌식 기준 타수. 한글 음절은 자모 수(2~5타), 그 외 문자는 1타.
 * 분당 타수(CPM) 계산의 분자가 된다.
 */
export function keystrokeCount(text: string): number {
  return decompose(text).length;
}

export function keystrokeCountChar(ch: string): number {
  return decomposeChar(ch).length;
}

/**
 * `typed`가 `target`의 타건 순서상 접두사인지. 같은 문자열도 접두사로 본다.
 * 조합 중인 글자를 오타로 표시하지 않기 위해 필요하다.
 */
export function isKeystrokePrefix(typed: string, target: string): boolean {
  const a = decompose(typed);
  const b = decompose(target);
  if (a.length > b.length) return false;
  return a.every((jamo, i) => jamo === b[i]);
}

/** 분당 타수. elapsedMs가 0 이하면 0. */
export function cpm(keystrokes: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (keystrokes / elapsedMs) * 60_000;
}
