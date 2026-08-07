import type { ModeConfig, ModeId } from "./types";

/**
 * 모드별 설정. 게임 루프는 하나뿐이고, 아래 값들만 달라진다.
 *
 * **본편은 quiz다** — 지도에 표시된 지역이 어디인지 떠올려 이름을 치는 것.
 * 그게 이 게임이 시군을 소재로 하는 이유이고, 지도가 장식이 아닌 이유다.
 *
 * 한때 `single`(이름 보고 따라 치기)을 입구로 뒀다가 되돌렸다. 회상 부담을
 * 낮추려던 것인데, 본편을 따라치기로 바꾸는 방식은 과했다 — 답이 적혀 있는데
 * 지도가 그 지역을 문제처럼 가리키니 무엇을 맞히는 게임인지 알 수 없었다.
 * 진입장벽은 **본편 안에서** 힌트와 쉬운 첫 코스로 낮춘다.
 *
 *   막히면 ← 지도 타이핑 → 잘하면
 *     연습              타임어택 → 암기
 */
export const MODES: Record<ModeId, ModeConfig> = {
  /** 지도만 보고 지역명을 떠올려 친다. 이게 본편이다. */
  quiz: {
    id: "quiz",
    reveal: false,
    shuffle: true,
    allowSkip: true,
    allowHint: true,
    // 초성은 사실상 절반의 정답이다. 지역 하나 치는 데 2~3초이므로
    // 5초면 "3초 더 생각해 볼까"를 진지하게 저울질하게 된다.
    hintPenaltyMs: 5_000,
  },

  /**
   * 연습. 이름을 보고 따라 친다.
   * 본편이 어려운 사람이 지명과 위치를 먼저 익히는 자리다 — 입구가 아니다.
   */
  single: {
    id: "single",
    reveal: true,
    shuffle: false,
    allowSkip: false,
    allowHint: false,
  },

  /** 본편과 같은 규칙에 시간 압박만 더한다. 오답 1회당 2초 차감. */
  timeattack: {
    id: "timeattack",
    reveal: false,
    timeLimitMs: 60_000,
    penaltyMs: 2_000,
    shuffle: true,
    allowSkip: true,
    allowHint: true,
    // 시간 제한이 있는 모드에서는 힌트도 남은 시간에서 깎는다.
    hintPenaltyMs: 5_000,
  },

  /**
   * 하드코어. 힌트 없이 코스 순서대로 끝까지.
   *
   * 포기는 열어 둔다. 힌트도 포기도 없으면 한 곳을 모르는 순간 그 판을
   * 끝낼 방법이 아예 없어져, 창을 닫는 것 말고는 길이 없었다.
   * 어려운 것과 막다른 길은 다르다.
   */
  memorize: {
    id: "memorize",
    reveal: false,
    shuffle: false,
    allowSkip: true,
    allowHint: false,
  },

  /**
   * 본편을 여럿이 동시에. 같은 방의 모두가 같은 순서를 봐야 하므로
   * 섞지 않고 코스 순서 그대로 간다.
   *
   * 건너뛰기가 없는 이유: 순위가 진행 칸수로 매겨지므로, 넘길 수 있으면
   * 다 넘긴 사람이 1등이 된다.
   *
   * 힌트에 추가 시간을 물리지 않는 이유: 순위는 실제 벽시계로 갈리고,
   * 힌트를 읽는 동안 상대는 계속 달린다. 값은 이미 치러진다.
   */
  multi: {
    id: "multi",
    reveal: false,
    shuffle: false,
    allowSkip: false,
    allowHint: true,
  },
};

export const MODE_LABELS: Record<ModeId, string> = {
  // 본편을 `퀴즈`라고 부르면 제품의 핵심이 부가 메뉴처럼 밀려난다.
  quiz: "지도 타이핑",
  timeattack: "타임어택",
  single: "연습",
  memorize: "암기",
  multi: "멀티",
};

/** 코스 선택 화면에서 모드 옆에 붙는 한 줄 설명. */
export const MODE_HINTS: Record<ModeId, string> = {
  quiz: "지도에 표시된 지역의 이름을 입력합니다 · 초성 힌트 가능",
  timeattack: "60초 안에 최대한 많이",
  single: "이름을 보며 따라 칩니다 · 지명과 위치를 익히는 연습",
  memorize: "힌트 없이 코스 순서 그대로 끝까지",
  multi: "최대 8명이 같은 지도를 놓고 동시에",
};

/** 화면에 나열하는 순서. 본편이 맨 앞이다. */
export const MODE_LADDER: ModeId[] = ["quiz", "timeattack", "single", "memorize"];

export function isModeId(value: string): value is ModeId {
  return value in MODES;
}
