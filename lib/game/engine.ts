import { isOnTrack } from "../hangul/match";
import { keystrokeCount } from "../hangul/keystrokes";
import { computeScore } from "../score/core";
import type {
  GameItem,
  GameState,
  ItemResult,
  ModeConfig,
  Score,
} from "./types";

/**
 * 모드에 상관없이 하나의 상태 기계로 게임을 돌린다.
 * 모드는 분기가 아니라 설정값(ModeConfig)이다 — 타임어택은 제한 시간이 있는 싱글이고,
 * 퀴즈는 단서를 보여주는 싱글이다.
 *
 * 모든 함수는 순수 함수이며 시각(now)을 인자로 받는다. React 없이 테스트할 수 있고,
 * 서버가 타건 기록을 그대로 재생해 검증할 수 있어야 하기 때문이다.
 */

/** mulberry32 — 시드가 같으면 항상 같은 순서. 멀티플레이와 서버 재생에 필요하다. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 정답으로 인정할 표기 집합. */
export function acceptedAnswers(item: GameItem): string[] {
  return [item.answer, ...(item.aliases ?? [])];
}

function matchesAnswer(item: GameItem, input: string): boolean {
  const value = input.trim();
  return acceptedAnswers(item).some((a) => a === value);
}

/** 어떤 정답 표기로든 가는 길 위에 있으면 정상 입력으로 본다. */
function onTrackForItem(item: GameItem, input: string): boolean {
  const value = input.trim();
  if (value === "") return true;
  return acceptedAnswers(item).some((a) => isOnTrack(a, value));
}

export function createGame(
  items: GameItem[],
  config: ModeConfig,
  now: number,
  seed = 1,
): GameState {
  const ordered = config.shuffle ? seededShuffle(items, seed) : items;
  return {
    config,
    items: ordered,
    index: 0,
    status: "ready",
    input: "",
    startedAt: now,
    endedAt: null,
    penaltyMs: 0,
    itemStartedAt: now,
    itemKeystrokes: 0,
    itemErrors: 0,
    lastKeystrokeCount: 0,
    offTrack: false,
    hintShown: false,
    hintShownAt: null,
    revealed: null,
    hintsUsed: 0,
    hintPenaltyMs: 0,
    keystrokes: [],
    results: [],
  };
}

/**
 * 지금 항목의 초성 힌트를 연다. 한 항목에 한 번만 세므로 다시 눌러도 늘지 않는다.
 * 되돌릴 수 없다 — 봤으면 본 것이다.
 */
export function revealHint(state: GameState, now = state.itemStartedAt): GameState {
  if (state.status !== "playing" || !state.config.allowHint) return state;
  if (state.hintShown) return state;

  /*
   * 대가를 어디서 받을지는 모드에 달렸다.
   * 시간 제한이 있으면 남은 시간에서 깎아야 체감이 되고, 없으면 최종 기록에
   * 더해야 타수에 반영된다. 반대로 붙이면 둘 다 아무 일도 일어나지 않는다.
   */
  const cost = state.config.hintPenaltyMs ?? 0;
  const timed = state.config.timeLimitMs !== undefined;

  return {
    ...state,
    hintShown: true,
    hintShownAt: now,
    hintsUsed: state.hintsUsed + 1,
    penaltyMs: state.penaltyMs + (timed ? cost : 0),
    hintPenaltyMs: state.hintPenaltyMs + (timed ? 0 : cost),
  };
}

export function start(state: GameState, now: number): GameState {
  if (state.status !== "ready") return state;
  return { ...state, status: "playing", startedAt: now, itemStartedAt: now };
}

/** 남은 시간(ms). 제한 시간이 없으면 Infinity. */
export function remainingMs(state: GameState, now: number): number {
  if (state.config.timeLimitMs === undefined) return Infinity;
  const end = state.endedAt ?? now;
  return state.config.timeLimitMs - (end - state.startedAt) - state.penaltyMs;
}

export function finish(state: GameState, now: number): GameState {
  if (state.status === "finished") return state;
  return { ...state, status: "finished", endedAt: now, input: "" };
}

/**
 * 전환이 끝났음을 알린다. 입력창이 비워진 뒤 화면 쪽에서 부른다.
 * 이 호출 전까지 들어온 입력은 이전 문제의 잔여물로 보고 버린다.
 */
export function settle(state: GameState): GameState {
  if (state.status !== "transitioning") return state;
  return { ...state, status: "playing" };
}

/**
 * 제한 시간 만료를 감지한다. 렌더 루프에서 주기적으로 호출.
 * 전환 상태도 여기서 풀린다 — 화면이 settle을 부르지 않아도 다음 프레임에
 * 스스로 빠져나오므로 판이 잠기는 일은 없다.
 */
export function tick(state: GameState, now: number): GameState {
  if (state.status === "revealing") {
    /*
     * 시간이 지났다고 알아서 넘어가지 않는다.
     *
     * 예전에는 1.5초 뒤에 자동으로 넘겼는데, 읽는 속도는 사람마다 다르고
     * 무엇보다 읽는 도중에 화면이 저절로 바뀌는 것이 불쾌하다. 다음으로
     * 가는 것은 사람이 정한다.
     *
     * 제한 시간은 그동안에도 흐른다. 답을 읽는 것도 판의 일부다.
     */
    if (remainingMs(state, now) <= 0) return finish(state, now);
    return state;
  }
  if (state.status === "transitioning") return settle(state);
  if (state.status !== "playing") return state;
  if (remainingMs(state, now) <= 0) return finish(state, now);
  return state;
}

/**
 * 입력 버퍼가 바뀔 때마다 호출한다. IME 조합 중 문자열도 그대로 넘긴다.
 * 정답과 일치하면 항목을 확정하고 다음으로 넘어간다.
 */
export function setInput(state: GameState, text: string, now: number): GameState {
  if (state.status !== "playing") return state;

  const item = state.items[state.index];
  const count = keystrokeCount(text);
  const delta = count - state.lastKeystrokeCount;
  const ok = onTrackForItem(item, text);

  let next: GameState = {
    ...state,
    input: text,
    lastKeystrokeCount: count,
    keystrokes:
      delta === 0 ? state.keystrokes : [...state.keystrokes, { t: now - state.startedAt, n: delta, ok }],
    // 정답 타수만 센다. 지운 만큼은 되돌린다.
    itemKeystrokes: ok && delta > 0 ? state.itemKeystrokes + delta : state.itemKeystrokes + Math.min(delta, 0),
  };

  // 경로를 벗어난 순간에만 오류 1회. 틀린 채로 계속 치는 동안 중복 집계하지 않는다.
  if (!ok && !state.offTrack) {
    next = {
      ...next,
      offTrack: true,
      itemErrors: state.itemErrors + 1,
      penaltyMs: state.penaltyMs + (state.config.penaltyMs ?? 0),
    };
  } else if (ok && state.offTrack) {
    next = { ...next, offTrack: false };
  }

  if (matchesAnswer(item, text)) return commitItem(next, now, false);
  return next;
}

/**
 * 모르겠다고 넘어간다.
 *
 * 정답을 보여 주지만 점수에서는 건너뛴 것과 똑같이 다룬다 — 완주 수에
 * 들어가지 않고 오답으로 기록된다. 정답을 봐서 이득이 생기면 그건 힌트가
 * 아니라 지름길이 된다.
 */
export function giveUp(state: GameState, now: number): GameState {
  if (state.status !== "playing" || !state.config.allowSkip) return state;
  const answer = state.items[state.index].answer;
  const next = commitItem(state, now, true);
  // 마지막 문제였다면 결과 화면이 곧 뜬다. 거기서 못 맞힌 곳을 이름으로 보여 준다.
  if (next.status === "finished") return next;
  return { ...next, status: "revealing", revealed: { answer } };
}

/** 정답을 다 읽었으니 그만 넘어간다. 이 호출 전까지는 그대로 머문다. */
export function settleReveal(state: GameState): GameState {
  if (state.status !== "revealing") return state;
  return { ...state, status: "playing", revealed: null };
}

/** @deprecated giveUp을 쓴다. 이름만 남겨 둔 옛 호출부용. */
export function skip(state: GameState, now: number): GameState {
  return giveUp(state, now);
}

function commitItem(state: GameState, now: number, skipped: boolean): GameState {
  const item = state.items[state.index];
  const result: ItemResult = {
    id: item.id,
    answer: item.answer,
    elapsedMs: now - state.itemStartedAt,
    keystrokes: skipped ? 0 : Math.max(0, state.itemKeystrokes),
    errors: state.itemErrors,
    skipped,
    hinted: state.hintShown,
    /*
     * 힌트를 보고 **맞힌** 경우에만 남는다.
     *
     * 건너뛰었다면 그 시간은 "초성을 보고도 답을 못 낸 시간"이지 힌트가
     * 통하기까지 걸린 시간이 아니다. 둘을 같은 통에 넣으면 "힌트가 약하다"와
     * "이 지역을 아예 모른다"가 섞여 어느 쪽도 알 수 없게 된다.
     *
     * 기준 시각은 그 문제에서 힌트를 **처음** 연 순간이다. 지금은 한 문제에
     * 힌트가 한 단계뿐이라 같은 말이지만, 단계가 늘어도 이 정의는 그대로 둔다.
     */
    ...(!skipped && state.hintShown && state.hintShownAt !== null
      ? { hintToAnswerMs: Math.max(0, now - state.hintShownAt) }
      : {}),
  };

  const advanced: GameState = {
    ...state,
    results: [...state.results, result],
    index: state.index + 1,
    input: "",
    itemStartedAt: now,
    itemKeystrokes: 0,
    itemErrors: 0,
    lastKeystrokeCount: 0,
    offTrack: false,
    hintShown: false,
    hintShownAt: null,
    revealed: null,
  };

  if (advanced.index >= advanced.items.length) return finish(advanced, now);
  // 다음 문제로 넘어가는 동안 들어오는 입력은 이전 조합의 잔여물이다.
  return { ...advanced, status: "transitioning" };
}

export function score(state: GameState, now: number): Score {
  const end = state.endedAt ?? now;
  // 힌트로 얻은 시간은 기록에 되돌려 놓는다. 그래야 타수에 그대로 반영된다.
  const elapsedMs = Math.max(0, end - state.startedAt) + state.hintPenaltyMs;
  const correctKeystrokes = state.results.reduce((a, r) => a + r.keystrokes, 0);
  const totalErrors = state.results.reduce((a, r) => a + r.errors, 0);
  const typed = state.keystrokes.reduce((a, k) => a + Math.max(0, k.n), 0);

  // 규칙은 lib/score/core.ts 한 벌뿐이다. 여기서는 재료만 모은다 —
  // 서버가 같은 규칙으로 다시 계산해 대조하기 때문이다.
  return computeScore({
    correctKeystrokes,
    typedKeystrokes: typed,
    elapsedMs,
    totalErrors,
    completed: state.results.filter((r) => !r.skipped).length,
    total: state.items.length,
    hintsUsed: state.hintsUsed,
  });
}
