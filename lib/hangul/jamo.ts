/**
 * 한글 음절 <-> 자모 변환.
 *
 * 타수(打數) 계산과 부분 입력 판정의 토대. 두벌식 자판 기준이므로
 * 겹받침(ㄳ)과 복합모음(ㅘ)은 두 번의 타건으로 취급하고,
 * 된소리(ㄲ)는 Shift 조합이지만 관례대로 한 타로 센다.
 */

export const SYLLABLE_BASE = 0xac00;
export const SYLLABLE_LAST = 0xd7a3;

export const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

export const JUNGSEONG = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
  "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ",
  "ㅣ",
] as const;

export const JONGSEONG = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

/** 두벌식에서 두 타로 나뉘는 겹받침. 된소리 ㄲ·ㅆ는 한 타이므로 제외. */
const CLUSTER_JONG: Record<string, string> = {
  "ㄳ": "ㄱㅅ", "ㄵ": "ㄴㅈ", "ㄶ": "ㄴㅎ", "ㄺ": "ㄹㄱ", "ㄻ": "ㄹㅁ",
  "ㄼ": "ㄹㅂ", "ㄽ": "ㄹㅅ", "ㄾ": "ㄹㅌ", "ㄿ": "ㄹㅍ", "ㅀ": "ㄹㅎ",
  "ㅄ": "ㅂㅅ",
};

/** 두벌식에서 두 타로 나뉘는 복합모음. ㅐㅒㅔㅖ는 단독 키라 제외. */
const CLUSTER_JUNG: Record<string, string> = {
  "ㅘ": "ㅗㅏ", "ㅙ": "ㅗㅐ", "ㅚ": "ㅗㅣ",
  "ㅝ": "ㅜㅓ", "ㅞ": "ㅜㅔ", "ㅟ": "ㅜㅣ",
  "ㅢ": "ㅡㅣ",
};

export function isSyllable(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= SYLLABLE_BASE && code <= SYLLABLE_LAST;
}

/** U+3131–U+3163. 조합 중이거나 단독으로 입력된 낱자. */
export function isCompatJamo(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= 0x3131 && code <= 0x3163;
}

export function isHangul(ch: string): boolean {
  return isSyllable(ch) || isCompatJamo(ch);
}

export interface Syllable {
  cho: string;
  jung: string;
  jong: string;
}

/** 완성형 음절을 초·중·종성으로 분해. 음절이 아니면 null. */
export function splitSyllable(ch: string): Syllable | null {
  if (!isSyllable(ch)) return null;
  const index = ch.codePointAt(0)! - SYLLABLE_BASE;
  return {
    cho: CHOSEONG[Math.floor(index / (21 * 28))],
    jung: JUNGSEONG[Math.floor(index / 28) % 21],
    jong: JONGSEONG[index % 28],
  };
}

/** 초·중·종성을 완성형 음절로 결합. 잘못된 자모면 null. */
export function joinSyllable(cho: string, jung: string, jong = ""): string | null {
  const c = CHOSEONG.indexOf(cho as (typeof CHOSEONG)[number]);
  const v = JUNGSEONG.indexOf(jung as (typeof JUNGSEONG)[number]);
  const t = JONGSEONG.indexOf(jong as (typeof JONGSEONG)[number]);
  if (c < 0 || v < 0 || t < 0) return null;
  return String.fromCodePoint(SYLLABLE_BASE + (c * 21 + v) * 28 + t);
}

/**
 * 한 글자를 두벌식 타건 순서의 낱자 배열로 분해한다.
 * 한글이 아니면 글자 자체를 한 타로 본다.
 *
 *   decomposeChar("값")  -> ["ㄱ", "ㅏ", "ㅂ", "ㅅ"]
 *   decomposeChar("좌")  -> ["ㅈ", "ㅗ", "ㅏ"]
 *   decomposeChar("ㄱ")  -> ["ㄱ"]
 */
export function decomposeChar(ch: string): string[] {
  const s = splitSyllable(ch);
  if (!s) return [ch];
  const out = [s.cho];
  out.push(...(CLUSTER_JUNG[s.jung] ?? s.jung));
  if (s.jong) out.push(...(CLUSTER_JONG[s.jong] ?? s.jong));
  return out;
}

/** 문자열 전체를 타건 순서의 낱자 배열로 분해. */
export function decompose(text: string): string[] {
  return [...text].flatMap(decomposeChar);
}

/**
 * 초성만 뽑는다. 한글이 아닌 글자는 그대로 둔다.
 *
 *   initials("의정부") -> "ㅇㅈㅂ"
 *
 * 지도만 보고 도무지 떠오르지 않을 때 주는 힌트다. 답을 알려 주지 않으면서
 * 기억을 끌어내는 최소한의 실마리라, 막혀서 그만두는 것을 막아 준다.
 */
export function initials(text: string): string {
  return [...text]
    .map((ch) => splitSyllable(ch)?.cho ?? ch)
    .join("");
}
