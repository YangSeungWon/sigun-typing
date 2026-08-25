/**
 * 오늘의 퀴즈 — 판의 규칙.
 *
 * 도형을 보고 이름을 맞힌다. 주 게임과 같은 일인데 셋이 다르다.
 *
 *   하루에 한 곳     모두가 같은 문제를 푼다. 링크 없이도 비교가 된다
 *   여섯 번          상한이 있어야 격자가 뜻을 가진다
 *   두 계단          어느 시도인가 → 어느 시군구인가
 *
 * ── 시도를 먼저 묻는 이유 ───────────────────────────────────
 * 지도를 함께 보여 주므로 어느 시도인지는 사실 보인다. 그래도 묻는 것은 **판을
 * 여는 쉬운 한 걸음**이기 때문이다. 229곳 중 하나를 맨손으로 대라고 하면 첫
 * 입력이 무겁고, 시도를 짚고 나면 그다음이 스물몇 곳으로 줄어든다.
 *
 * 그래서 시도는 **횟수를 안 깎는다.** 그건 문제를 푸는 것이 아니라 판을 여는
 * 절차다. 틀렸다고 여섯 번에서 빼면 두 게임이 섞인다.
 *
 * ── 힌트가 없는 이유 ────────────────────────────────────────
 * `4 / 6`이 모두에게 같은 뜻이어야 한다. 힌트를 주면 "세 번에 맞혔지만 힌트 봄"과
 * "세 번에 그냥 맞힘"이 같은 격자로 나가서, 단톡방에서 견주는 순간 말이 안 된다.
 * 그리고 힌트가 할 일은 이미 다른 것이 한다 — 틀린 답이 지도에서 켜진다.
 */

import { quizDate } from "./pick";

export const MAX_TRIES = 6;

/**
 * 얼마나 가까웠나.
 *
 * 초성 대신 **거리**가 단서다. 지리 퀴즈에서 그 편이 정직하고, 격자에도 색이
 * 하나 더 생겨 이야기가 된다.
 *
 * `near`의 임계는 전국 지도 좌표로 40이다. 같은 시도 안의 두 곳 사이 거리가
 * 중앙값 69라, 40이면 같은 시도를 답해도 셋 중 하나만 노랑이 된다 — 더 늘리면
 * 대부분 노랑이라 아무 말도 안 하게 된다.
 */
export const NEAR = 40;

export type Closeness = "hit" | "near" | "far";

export interface Point {
  cx: number;
  cy: number;
}

export function closeness(guess: Point, answer: Point, exact: boolean): Closeness {
  if (exact) return "hit";
  return Math.hypot(guess.cx - answer.cx, guess.cy - answer.cy) <= NEAR
    ? "near"
    : "far";
}

export const QUIZ_EMOJI: Record<Closeness, string> = {
  hit: "🟩",
  near: "🟨",
  far: "🟥",
};

/**
 * 결과를 주소 한 조각으로.
 *
 * 공유 그림은 서버가 그리므로 주소 말고는 아는 것이 없다. 색이 셋뿐이라 글자
 * 하나면 되고, 회차와 붙여 `2-nffh` 꼴이 된다.
 *
 * 이모지를 주소에 실을 수는 없다 — 퍼센트 인코딩으로 한 칸에 열두 자가 된다.
 */
const LETTER: Record<Closeness, string> = { hit: "h", near: "n", far: "f" };

export function cardCode(state: QuizState): string {
  return `${state.day}-${state.guesses.map((g) => LETTER[g.closeness]).join("")}`;
}

export interface QuizState {
  /** 며칠째 문제인가. 날이 바뀌면 저장된 판을 버리는 기준이다. */
  day: number;
  /** 시도 단계에서 고른 코드들. 마지막 것이 정답이면 통과다. */
  sidoPicks: string[];
  /** 시군구 단계에서 낸 답들. 순서가 곧 격자다. */
  guesses: { name: string; closeness: Closeness }[];
  /** 맞혔는가. 못 맞히고 여섯 번을 다 쓰면 false인 채로 끝난다. */
  solved: boolean;
}

export function emptyState(day: number): QuizState {
  return { day, sidoPicks: [], guesses: [], solved: false };
}

/** 시도를 맞혀 두 번째 계단에 올라섰는가. */
export function sidoCleared(state: QuizState, answerSido: string): boolean {
  return state.sidoPicks.includes(answerSido);
}

/** 더 낼 수 있는가. 맞혔거나 여섯 번을 다 썼으면 끝이다. */
export function isOver(state: QuizState): boolean {
  return state.solved || state.guesses.length >= MAX_TRIES;
}

/**
 * 공유 덩어리.
 *
 * 주 게임의 공유와 같은 문법이다 — 가운데점을 안 쓰고, 마지막 줄은 도발이 아니라
 * 초대다. 정답은 적지 않는다. 아직 안 푼 사람에게 그걸 보내면 그날 문제가
 * 통째로 사라진다.
 */
export function quizShareText(state: QuizState): string {
  const lines = ["시군 타이핑", `오늘의 퀴즈 ${quizDate(state.day)}`];

  /*
   * **시도는 안 적는다.**
   *
   * 점수로는 문제가 없다 — 시도 맞히기는 횟수를 안 깎으니 공정성이 안 걸린다.
   * 걸리는 것은 받는 사람이다. `경기 3 / 6`을 받으면 첫 질문의 답을 알고
   * 시작하므로, 같은 판을 푸는 것이 아니라 반쯤 풀린 판을 물려받는다.
   *
   * 화면 안에서는 보여 준다. 거기서는 자기가 짚은 것이라 스포일러가 아니다.
   */
  lines.push(
    state.solved ? `${state.guesses.length} / ${MAX_TRIES}` : `X / ${MAX_TRIES}`,
  );

  if (state.guesses.length > 0) {
    lines.push("", state.guesses.map((g) => QUIZ_EMOJI[g.closeness]).join(""));
  }

  lines.push("", "같이 한 판?");
  return lines.join("\n");
}
