import { KST_OFFSET_MS } from "../score/period";

/**
 * 오늘의 도전.
 *
 * 첫 화면을 메뉴가 아니라 **오늘 열어 볼 이유가 있는 화면**으로 만드는 조각이다.
 * 어제와 오늘이 같으면 다시 올 이유가 하나 줄어든다.
 *
 * 무작위가 아니라 날짜에서 계산한다. 그래야 하루 안에서는 새로고침해도 같고,
 * 서버와 브라우저가 같은 답을 내며, 무엇보다 **모두에게 같다** — 그게 데일리의
 * 요점이다. 사람마다 다르면 그냥 추천이지 오늘의 도전이 아니다.
 */

/** 한국 날짜. `2026-08-13`. */
export function kstDateKey(now: number): string {
  /*
   * 컨테이너는 UTC로 돈다. 그대로 자르면 한국 시간 아침 9시에 날짜가 바뀐다.
   * 한국 벽시계를 UTC 필드에 담아 두고 getUTC*로 읽는다 —
   * `lib/score/period.ts`의 periodStart와 같은 수법이고, 상수도 그것을 쓴다.
   */
  const kst = new Date(now + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** FNV-1a. 짧은 문자열을 고르게 흩기만 하면 되므로 이만한 것으로 충분하다. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 그날의 코스.
 *
 * 날짜를 그대로 나눠 쓰지(`날짜 % 개수`) 않는다. 그러면 코스가 열일곱이라
 * 열일곱 일마다 정확히 같은 순서가 돌아 요일과 코스가 굳어 버린다.
 * 해시를 한 번 통과시켜 순서를 섞는다.
 */
export function pickDailyCourse(ids: string[], dateKey: string): string | null {
  if (ids.length === 0) return null;
  return ids[hash(dateKey) % ids.length];
}
