/**
 * X(트위터)로 보내기.
 *
 * 인텐트 주소에 본문을 실어 열면 작성창이 채워진 채로 뜬다. 데스크톱에는
 * `navigator.share`가 없어서, 그것 없이는 복사하고 X를 열고 붙여넣는 세 단계다.
 *
 * ── 280자에 격자가 안 들어갈 때가 있다 ──────────────────────
 * X는 글자마다 무게가 다르다. 라틴·숫자는 1이고 그 밖(한글과 이모지)은 2다.
 * 그래서 전국 229 시군구의 19×19 격자는 그것만으로 741이라 절대 안 들어간다.
 * 서울(8×5)은 85라 넉넉하다.
 *
 * 넘치면 **격자를 뺀다.** 자르지 않는다 — 반쯤 잘린 지도는 지도가 아니라
 * 깨진 그림이고, 그 판을 자랑하려던 사람에게 가장 나쁜 결과다. 격자를 빼도
 * 기록과 링크는 남고, 링크를 펼치면 카드에 지도가 있다.
 */

/** 링크는 무엇을 넣든 t.co 길이로 계산된다. */
const URL_WEIGHT = 23;
const LIMIT = 280;

/**
 * X가 세는 방식 그대로 잰다.
 *
 * 코드포인트 4351까지는 1, 그 위는 2다(한글도 이모지도 여기 걸린다).
 * `length`로 재면 이모지가 2로 세어져 우연히 맞는 듯 보이지만 한글이 1로
 * 세어져 크게 어긋난다.
 */
export function tweetWeight(text: string): number {
  let sum = 0;
  for (const ch of text) sum += ch.codePointAt(0)! <= 4351 ? 1 : 2;
  return sum;
}

export function fitsTweet(text: string): boolean {
  // 본문과 링크 사이의 공백 하나까지 센다.
  return tweetWeight(text) + 1 + URL_WEIGHT <= LIMIT;
}

export function tweetUrl(text: string, url: string): string {
  const q = new URLSearchParams({ text, url });
  return `https://x.com/intent/tweet?${q}`;
}
