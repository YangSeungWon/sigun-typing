import { KST_OFFSET_MS } from "@/lib/score/period";

/**
 * 오늘의 퀴즈 — 하루에 한 곳.
 *
 * 코스를 하루에 하나씩 돌리는 안이 먼저 있었는데, 코스는 열일곱 개뿐이고
 * 사람마다 관심 있는 코스가 다르다. 단위를 코스에서 **지역 하나**로 낮추면
 * 그 문제가 사라진다 — 시군구는 229곳이라 하루 하나씩 써도 일곱 달 치다.
 *
 * ── 왜 하루에 하나인가 ──────────────────────────────────────
 * 도전장은 누가 먼저 링크를 보내야 대화가 시작된다. 오늘의 퀴즈는 **모두가
 * 같은 문제를 풀기 때문에** 링크 없이도 비교가 된다. 단톡방에 격자만 던져도
 * 말이 되는 것이 이 형식의 전부다.
 *
 * ── 정답을 어떻게 정하는가 ──────────────────────────────────
 * 서버에 묻지 않는다. 날짜에서 계산해 내면 서버와 브라우저가, 그리고 사람과
 * 사람이 같은 답을 얻는다. 답을 미리 알아내려면 코드를 읽으면 되지만, 이건
 * 순위가 걸린 값이 아니라 오늘 뭘 물을지일 뿐이다.
 *
 * 무작위로 뽑지 않고 **순열을 한 바퀴 돈다.** 매일 독립적으로 뽑으면 같은
 * 곳이 사흘 만에 또 나오기도 하고 어떤 곳은 반년째 안 나오기도 한다.
 */

/**
 * 첫날. 이 날짜가 0일차다. KST 자정 기준.
 *
 * 앞으로 당기면 회차 번호가 어긋나고, 뒤로 밀면 그날까지 음수 일차가 나온다.
 * 한 번 정하면 안 건드리는 값이다.
 */
export const EPOCH_KST = Date.UTC(2026, 7, 19);

/** KST 벽시계로 며칠째인가. */
export function dayIndex(now: number): number {
  const kst = now + KST_OFFSET_MS;
  const midnight = Date.UTC(
    new Date(kst).getUTCFullYear(),
    new Date(kst).getUTCMonth(),
    new Date(kst).getUTCDate(),
  );
  return Math.floor((midnight - EPOCH_KST) / 86_400_000);
}

/**
 * 순열을 만든다. 한 바퀴를 다 돌아야 같은 곳이 다시 나온다.
 *
 * 곱셈군을 쓴다 — `n`과 서로소인 `step`으로 건너뛰면 모든 자리를 정확히 한 번씩
 * 지난다. 표를 미리 만들어 둘 필요도, 셔플을 저장할 필요도 없다.
 *
 * 이웃한 날이 지도에서도 이웃하면 재미가 없으므로(코드 순서가 곧 행정구역
 * 순서다) 보폭을 크게 잡는다.
 *
 * **바퀴마다 보폭을 바꾼다.** 시작점만 옮기면 두 바퀴째가 첫 바퀴의 회전일
 * 뿐이라, 229일 뒤에 어제와 오늘의 짝이 통째로 되풀이된다. 실제로 그랬다 —
 * 229·230·231일차가 10·11·12일차와 같은 순서였다.
 */
const STEPS = [97, 61, 149, 83, 173, 53, 127, 199, 71, 113];

/** 총 개수와 서로소인 보폭만 쓴다. 아니면 한 자리만 맴돈다. */
function stepFor(round: number, total: number): number {
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[(round + i) % STEPS.length] % total;
    if (step > 0 && gcd(step, total) === 1) return step;
  }
  return 1;
}

/** 몇 바퀴째인가에 따라 시작점도 옮긴다. */
function offsetOf(round: number): number {
  // 라운드마다 다른, 그러나 정해진 값. 곱하고 섞어 큰 수로 만든 뒤 접는다.
  let x = (round + 1) * 2_654_435_761;
  x ^= x >>> 15;
  return Math.abs(x);
}

export function pickIndex(day: number, total: number): number {
  if (total <= 0) return 0;
  const round = Math.floor(day / total);
  const nth = ((day % total) + total) % total;
  return (offsetOf(round) + nth * stepFor(round, total)) % total;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export interface DailyPick<T> {
  /** 0일차부터 센 날짜. 공유 문구의 회차이기도 하다. */
  day: number;
  item: T;
}

export function pickForDay<T>(items: readonly T[], now: number): DailyPick<T> | null {
  if (items.length === 0) return null;
  const day = dayIndex(now);
  return { day, item: items[pickIndex(day, items.length)] };
}
