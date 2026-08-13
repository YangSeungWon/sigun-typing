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
    itemErrors: 0,
    lastKeystrokeCount: 0,
    offTrack: false,
    itemWrong: [],
    rejectedAt: null,
    hintShown: false,
    hintShownAt: null,
    revealed: null,
    revealInput: "",
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
  /*
   * 정답을 보여 주는 동안의 입력은 따로 받는다.
   *
   * 모르겠다고 넘긴 자리에서 정답을 눈으로만 보고 지나가면 다음에 또 모른다.
   * 손으로 한 번 쓰는 것이 눈으로 보는 것보다 훨씬 잘 남는다 — 어차피
   * 타자 게임이므로 이 게임이 학습에 보태는 것이 정확히 그 지점이다.
   *
   * 점수에는 넣지 않는다. 이건 회상이 아니라 베껴 쓰기이고, 여기서 친 타수를
   * 세면 모르는 곳을 넘길수록 타수가 오르는 이상한 일이 된다.
   */
  if (state.status === "revealing" && state.revealed) {
    if (/\s/.test(text)) {
      const typed = text.replace(/\s+/g, "");
      return typed === state.revealed.answer
        ? settleReveal(state)
        : { ...state, revealInput: typed };
    }
    return { ...state, revealInput: text };
  }

  if (state.status !== "playing") return state;

  /*
   * 스페이스는 제출이다.
   *
   * 키를 가로채지 않고 **입력에 들어온 공백을 보고** 판단한다. 한글 IME에서
   * 스페이스는 조합을 끝내는 키이기도 해서, keydown을 가로채면 아직 조합
   * 중인 마지막 글자가 확정되기 전에 제출이 나간다. 값에 공백이 들어온
   * 시점에는 조합이 이미 끝나 있다.
   *
   * 공백은 타수로 세지 않는다. 엔터로 내는 사람과 값이 달라지면 같은 실력이
   * 다른 타수로 찍히고, 서버가 다시 계산한 값과도 어긋난다. 지역 이름에
   * 공백이 든 것은 하나도 없으므로 이 규칙이 정답을 가로막는 일은 없다.
   */
  if (/\s/.test(text)) {
    /*
     * 공백을 떼어 낸 값으로 한 번 더 들어갔다 나온다. 그래야 마지막 글자까지
     * 타수에 들어간다 — 값이 통째로 들어오는 경우(붙여넣기, 자동완성, 조합을
     * 한 번에 확정하는 자판)에 그 글자들이 통째로 빠지고 타수가 0이 된다.
     * 떼어 낸 값에는 공백이 없으므로 여기로 다시 오지 않는다.
     */
    return submit(setInput(state, text.replace(/\s+/g, ""), now), now);
  }

  const item = state.items[state.index];
  const count = keystrokeCount(text);
  const delta = count - state.lastKeystrokeCount;
  const ok = onTrackForItem(item, text);

  const next: GameState = {
    ...state,
    input: text,
    lastKeystrokeCount: count,
    keystrokes:
      delta === 0 ? state.keystrokes : [...state.keystrokes, { t: now - state.startedAt, n: delta, ok }],
  };

  /*
   * 다 쳤다고 저절로 넘어가지 않는다.
   *
   * 예전에는 정답과 일치하는 순간 넘겼다. 빠르기는 한데, `전남`을 칠 때
   * `전나`에서 ㅁ을 누르는 그 순간 화면이 바뀐다 — 조합이 끝나기도 전에
   * 판이 손을 잡아채는 느낌이라 리듬이 끊긴다. 게다가 맞으면 키가 필요
   * 없고 틀리면 필요한, 두 개의 다른 흐름이 생긴다.
   *
   * 이제 제출은 언제나 사람이 한다(스페이스·엔터). 넘어가는 순간을 내가
   * 정하므로 화면이 예고 없이 바뀌는 일이 없다.
   */

  // 치는 도중의 오답 표시는 답이 화면에 있는 모드에서만. 가린 모드에서
  // 색이 바뀌면 그게 곧 답을 알려 주는 셈이라 회상 게임이 성립하지 않는다.
  if (state.config.judge === "enter") return next;

  /*
   * 경로를 벗어났다는 **표시만** 남긴다. 세지는 않는다.
   *
   * 한때 여기서 오타 1회를 세었다. 그러면 치다가 한 글자 잘못 눌러 지우고 다시
   * 친 것이 틀린 것으로 남는다 — 손이 미끄러진 것과 몰라서 틀린 것을 같은
   * 통에 넣는 셈이다. 무오타 연속도 그때 끊겼다.
   *
   * 판정은 제출로만 한다. 지우고 고칠 자유는 그 전까지 온전히 열어 둔다.
   * 이 값은 판면을 흔들어 "지금 경로를 벗어났다"고 알리는 데만 쓴다.
   */
  return { ...next, offTrack: !ok };
}

/**
 * 답을 제출한다. 스페이스와 엔터가 같은 일을 한다.
 *
 * 맞으면 다음으로, 틀리면 오답 1회로 적는다. 판도 입력도 그 자리에 그대로
 * 있으므로 틀린 자리만 고치면 된다 — 회상 게임에서 한 번 틀린 것은 실패가
 * 아니라 과정이다.
 *
 * 틀린 답을 **그대로 남긴다.** 나중에 무엇을 무엇으로 착각했는지 되짚는 데
 * 쓰이고, 그게 이 게임이 만들어 낼 수 있는 가장 값진 데이터다.
 */
export function submit(state: GameState, now: number): GameState {
  // 정답을 베껴 쓰는 중이라면, 다 썼을 때만 넘어간다.
  if (state.status === "revealing" && state.revealed) {
    return state.revealInput.trim() === state.revealed.answer ? settleReveal(state) : state;
  }
  if (state.status !== "playing") return state;

  const text = state.input.trim();
  // 빈 채로 엔터를 치는 것은 실수다. 벌을 주지 않는다.
  if (text === "") return state;

  const item = state.items[state.index];
  if (matchesAnswer(item, text)) return commitItem(state, now, false, text);

  /*
   * 같은 답을 연달아 또 내는 것은 새로운 오답이 아니다.
   *
   * 오답을 지우지 않게 되면서 엔터를 한 번 더 누르는 것만으로 같은 글자가
   * 다시 접수된다 — 실수로, 또는 정말 그 답이 맞다고 믿어서. 그때마다
   * 오답과 시간 벌점을 또 매기면 아무것도 새로 하지 않은 사람이 벌을 받는다.
   * 판은 다시 한 번 빨개지되(rejectedAt) 셈은 그대로 둔다.
   */
  if (state.itemWrong[state.itemWrong.length - 1] === text) {
    return { ...state, rejectedAt: now };
  }

  return {
    ...state,
    /*
     * 틀린 답을 **지우지 않고 그대로 둔다.**
     *
     * `남대`라고 냈다면 고쳐야 할 것은 `대` 한 글자다. 판을 비워 버리면
     * 아무 잘못도 없는 `남`까지 다시 쳐야 하고, 무엇을 냈는지도 화면에서
     * 사라져 무엇과 헷갈렸는지 되짚을 수 없다. 오답은 실패가 아니라 고치는
     * 중이므로, 고칠 것을 손에 쥐여 준 채로 둔다.
     *
     * 타수 상태(lastKeystrokeCount)도 건드리지 않는다. 화면의 글자가 그대로
     * 남는데 세던 값만 0으로 되돌리면 다음에 한 글자를 지우는 순간 계산이
     * 어긋난다. 제출이 거부된 것뿐 친 것이 사라진 것은 아니다.
     */
    // 틀림은 제출로만 판정한다. 치는 도중에는 어느 모드에서도 세지 않는다.
    itemErrors: state.itemErrors + 1,
    itemWrong: [...state.itemWrong, text],
    rejectedAt: now,
    // 시간 제한이 있는 모드에서는 오답이 시간을 깎는다. 이유는 위와 같다.
    penaltyMs:
      state.penaltyMs +
      (state.config.judge === "enter" ? (state.config.penaltyMs ?? 0) : 0),
  };
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
  /*
   * 마지막 문제도 예외가 아니다.
   *
   * 한때 여기서 바로 결과로 보냈다 — 어차피 결과 화면이 못 맞힌 곳을 이름으로
   * 보여 주니까. 그런데 이 기능이 하려는 일은 이름을 **보여 주는 것**이 아니라
   * 손으로 한 번 쓰게 하는 것이다. 눈으로 보고 지나가면 다음에 또 모른다.
   *
   * 게다가 마지막 하나만 다르게 굴면 놀란다. 모르겠다고 눌렀는데 답을 보기도
   * 전에 판이 끝나 있다.
   *
   * 시계는 여기서 이미 멈춰 있다(commitItem이 끝을 기록했다). 답을 베껴 쓰는
   * 동안 기록이 늘지 않는다.
   */
  return { ...next, status: "revealing", revealed: { answer } };
}

/** 정답을 다 썼으니 넘어간다. 이 호출 전까지는 그대로 머문다. */
export function settleReveal(state: GameState): GameState {
  if (state.status !== "revealing") return state;
  const cleared = { ...state, revealed: null, revealInput: "" };
  // 더 낼 문제가 없으면 여기가 끝이다. endedAt은 포기한 순간에 이미 박혔다.
  if (cleared.index >= cleared.items.length) {
    return { ...cleared, status: "finished" };
  }
  return { ...cleared, status: "playing" };
}

/** @deprecated giveUp을 쓴다. 이름만 남겨 둔 옛 호출부용. */
export function skip(state: GameState, now: number): GameState {
  return giveUp(state, now);
}

function commitItem(
  state: GameState,
  now: number,
  skipped: boolean,
  /** 정답으로 인정된 제출. 별칭으로 맞혔으면 그 별칭이다. */
  accepted?: string,
): GameState {
  const item = state.items[state.index];
  const result: ItemResult = {
    id: item.id,
    answer: item.answer,
    elapsedMs: now - state.itemStartedAt,
    /*
     * 맞힌 곳의 타수는 **제출한 답의 타수**다.
     *
     * 치는 동안 눌린 타건을 세지 않는다. 지웠다 다시 쳐도, 틀린 뒤 고쳐도 같은
     * 값이 나와야 한다 — 손이 미끄러진 것이 기록을 깎으면 안 된다.
     */
    keystrokes: skipped ? 0 : keystrokeCount(accepted ?? item.answer),
    errors: state.itemErrors,
    skipped,
    // 오답 제출 뒤에 맞혔으면 그만큼 시도가 늘어난다. 1이면 한 번에 맞혔다.
    attempts: state.itemWrong.length + 1,
    ...(state.itemWrong.length > 0 ? { wrongAnswers: state.itemWrong } : {}),
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
    itemErrors: 0,
    lastKeystrokeCount: 0,
    offTrack: false,
    itemWrong: [],
    rejectedAt: null,
    hintShown: false,
    hintShownAt: null,
    revealed: null,
    revealInput: "",
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
  /*
   * 타건 기록(state.keystrokes)은 점수에 쓰지 않는다. 서버가 사람의 리듬인지
   * 보는 데만 쓴다.
   */

  // 규칙은 lib/score/core.ts 한 벌뿐이다. 여기서는 재료만 모은다 —
  // 서버가 같은 규칙으로 다시 계산해 대조하기 때문이다.
  return computeScore({
    correctKeystrokes,
    elapsedMs,
    totalErrors,
    completed: state.results.filter((r) => !r.skipped).length,
    total: state.items.length,
    hintsUsed: state.hintsUsed,
    firstTry: state.results.filter((r) => !r.skipped && r.attempts <= 1).length,
  });
}
