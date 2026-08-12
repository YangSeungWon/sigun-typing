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
 *   막히면 ← 지도 타이핑
 *     연습(이름 보고 익히기)
 */
export const MODES: Record<ModeId, ModeConfig> = {
  /** 지도만 보고 지역명을 떠올려 친다. 이게 본편이다. */
  map: {
    id: "map",
    judge: "enter",
    reveal: false,
    shuffle: true,
    allowSkip: true,
    allowHint: true,
    /*
     * 초성은 사실상 절반의 정답이다. 5초로는 싸다 — 지역 하나를 2~3초에 치니
     * 한 판에 몇 번을 봐도 기록이 크게 흔들리지 않았고, 힌트가 "얼마를 물면
     * 되나"를 계산하는 상품이 됐다.
     *
     * 30초면 그 판은 사실상 순위에서 내려온다. 그래도 힌트를 없애지는 않는다 —
     * 막힌 사람이 판을 끝낼 수 있어야 하고, 초성을 보고 떠올린 지역은 오답노트에
     * 남아 다음에 다시 나온다. 겨루는 판과 배우는 판을 가르는 것은 이 값이다.
     */
    hintPenaltyMs: 30_000,
  },

  /**
   * 연습. 이름을 보고 따라 친다.
   * 본편이 어려운 사람이 지명과 위치를 먼저 익히는 자리다 — 입구가 아니다.
   */
  learn: {
    id: "learn",
    judge: "live",
    reveal: true,
    shuffle: false,
    allowSkip: false,
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
    judge: "enter",
    reveal: false,
    shuffle: false,
    allowSkip: false,
    allowHint: true,
  },
};

/**
 * 화면에 뜨는 이름.
 *
 * 내부 id는 규칙을 기준으로 갈랐지만(순서를 섞는가, 답을 보여 주는가),
 * 사용자는 규칙이 아니라 목적으로 고른다. `암기`는 시스템이 하는 일이고
 * `실력 테스트`는 사용자가 하려는 일이다 — "오늘 암기 모드를 해야지"라고
 * 생각하는 사람은 없고 "이제 진짜 다 외웠나 볼까"라고 생각한다.
 *
 * id와 주소는 그대로 둔다. 이미 나간 도전장 링크가 살아 있어야 한다.
 */
export const MODE_LABELS: Record<ModeId, string> = {
  map: "지도 타이핑",
  learn: "이름 보고 익히기",
  multi: "친구와 대결",
};

/**
 * 모드 옆에 붙는 한 줄.
 *
 * 규칙이 아니라 결과를 말한다. "코스 순서 고정"은 구현이고, 사용자가
 * 알고 싶은 것은 "힌트 없이 얼마나 아는지"다.
 */
export const MODE_HINTS: Record<ModeId, string> = {
  map: "지도를 보고 이름 맞히기",
  learn: "이름을 보며 위치 익히기",
  multi: "최대 8명이 같은 지도를 놓고 동시에",
};

/** 화면에 나열하는 순서. 진짜 하는 것이 먼저, 연습이 뒤. */
export const MODE_LADDER: ModeId[] = ["map", "learn"];

/**
 * 순위표에 올리는 모드.
 *
 * `learn`이 빠진다. 답이 화면에 적혀 있으므로 거기서 재는 것은 회상이 아니라
 * **타자 속도**다. 그걸 회상 모드들과 같은 표에 놓으면 기억을 쓰지 않아도 되는
 * 모드가 가장 높은 타수를 내고, 그 표는 이 게임이 무엇을 겨루는 곳인지
 * 스스로 부정한다.
 *
 * 개인 기록은 그대로 남는다. 남과 겨루지 않을 뿐, 어제의 나보다 빨라졌는지는
 * 연습에서도 알 만한 값이다.
 *
 * 한때 MODE_LADDER를 그대로 순위표 탭으로 썼다. 그건 이용안내에서 모드를
 * 소개하는 순서이지 겨룰 수 있는 판의 목록이 아니었다 — 하필 순위표의 기본
 * 모드까지 learn이라, 랭킹을 처음 여는 사람이 보는 것이 따라치기 순위표였다.
 */
export const RANKED_MODES: ModeId[] = ["map"];

export function isRankedMode(mode: ModeId): boolean {
  return RANKED_MODES.includes(mode);
}

export function isModeId(value: string): value is ModeId {
  return value in MODES;
}
