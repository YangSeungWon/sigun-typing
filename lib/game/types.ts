/**
 * 판의 종류.
 *
 * 둘뿐이다 — **진짜 하는 것과 연습.** 한때 타임어택(60초)과 실력 테스트(힌트
 * 없이)를 따로 두었는데, 셋 다 같은 게임에 스위치 하나씩만 다른 것이었고
 * 순위표만 셋으로 쪼개졌다. 힌트 값을 제대로 물리자 실력 테스트는 정의상
 * 본편과 같아졌다(힌트 없는 모드 = 힌트를 안 쓴 판).
 *
 * multi는 방에서 여럿이 같은 문제를 푸는 것이라 별도 흐름이다.
 */
export type ModeId = "learn" | "map" | "multi";

/** 코스에 담긴 한 항목 — 보통 하나의 시·군·구. */
export interface GameItem {
  /** 행정구역 코드 등 안정적인 식별자 */
  id: string;
  /** 정답으로 표시할 정식 명칭 (예: "수원시") */
  answer: string;
  /** 함께 정답으로 인정할 표기. 옛 이름 등, 이유가 있을 때만 (예: "남구") */
  aliases?: string[];
  /** 퀴즈 모드에서 보여줄 단서 */
  hint?: string;
}

export interface ModeConfig {
  id: ModeId;
  /** 정답을 화면에 보여줄지. false면 지도만 보고 떠올려야 한다. */
  reveal: boolean;
  /**
   * 오답을 언제 판정하는가. 모드마다 과제가 다르기 때문에 갈린다.
   *
   * `"live"` — 치는 즉시. 답이 화면에 있는 **따라치기**용이다. 여기서는
   * 손이 목표이므로 어긋난 자리를 바로 빨갛게 보여 주는 것이 맞다.
   *
   * `"enter"` — 엔터로 제출할 때. **회상** 모드용이다. 두 가지 이유가 있다.
   * 첫째, 치는 도중에 빨강이 뜨면 그게 힌트가 된다 — 초성만 하나씩 눌러 봐도
   * 정답 후보를 좁힐 수 있어 회상 게임의 전제가 무너진다. 둘째, 접두사
   * 판정만 있으면 **틀린 답을 제출할 수가 없어서**(지우는 것 말고 길이 없다)
   * "안산을 연천으로 착각했다"가 기록에 남지 않는다. 이 게임에서 가장 값진
   * 정보가 그것이다.
   *
   * 정답과 정확히 일치하면 엔터 없이도 넘어간다. 그러니 엔터가 손을 더
   * 쓰게 만드는 경우는 **틀린 사람뿐**이다.
   */
  judge: "live" | "enter";
  /** 막혔을 때 초성 힌트를 요청할 수 있는지 */
  allowHint: boolean;
  /** 제한 시간. 없으면 무제한. */
  timeLimitMs?: number;
  /** 오답 1회당 차감 시간 (타임어택) */
  penaltyMs?: number;
  /** 초성 힌트 1회당 기록에 더해지는 시간 */
  hintPenaltyMs?: number;
  /** 항목을 무작위로 섞을지 — 순서가 곧 재미인 싱글에서는 false */
  shuffle: boolean;
  /** 건너뛰기 허용 여부 */
  allowSkip: boolean;
}

/**
 * 판의 상태.
 *
 * `transitioning`이 핵심이다. 정답이 확정된 직후 몇 프레임 동안
 * 다음 문제 선택 · 지도 갱신 · 입력창 초기화 · IME 조합 종료가 한꺼번에
 * 일어나는데, 그 사이 입력을 그대로 받으면 이전 문제의 마지막 조합이
 * 다음 문제 앞에 흘러든다. 그 구간을 상태로 못박아 입력을 무시한다.
 *
 *   ready → playing ⇄ transitioning → finished
 */
export type GameStatus =
  | "ready"
  | "playing"
  /** 정답 직후. 남은 조합 입력이 다음 문제로 새지 않게 잠깐 막는다 */
  | "transitioning"
  /** 포기해서 정답을 보여 주는 중 */
  | "revealing"
  | "finished";

/** 서버 검증용 타건 기록. t는 시작 시점부터의 경과 ms. */
export interface Keystroke {
  t: number;
  /** 이번 입력 이벤트에서 늘어난(양수) 또는 지워진(음수) 타수 */
  n: number;
  /** 입력이 정답 경로 위에 있는지 */
  ok: boolean;
}

export interface ItemResult {
  id: string;
  answer: string;
  /** 이 항목에 쓴 시간 */
  elapsedMs: number;
  /** 정답 타수 */
  keystrokes: number;
  /**
   * 이 항목에서 틀린 횟수.
   *
   * `live` 모드에서는 정답 경로를 벗어난 횟수, `enter` 모드에서는 오답을
   * 제출한 횟수다. 둘 다 "여기서 몇 번 헛디뎠나"이지만 단위가 다르다.
   */
  errors: number;
  /**
   * 제출 횟수. 맞힌 제출까지 포함하므로 1이면 첫 제출에 맞혔다는 뜻이다.
   * `live` 모드에서는 항상 1이다 — 거기에는 제출이라는 개념이 없다.
   */
  attempts: number;
  /**
   * 제출했다가 틀린 답들. 무엇을 무엇으로 착각하는지가 여기 남는다.
   * 같은 코스의 다른 지역 이름이면 혼동이고, 한두 자모 차이면 오타다.
   */
  wrongAnswers?: string[];
  skipped: boolean;
  /** 이 항목에서 초성 힌트를 봤는지 — 힌트를 봤다는 건 몰랐다는 뜻이다 */
  hinted: boolean;
  /**
   * 힌트를 연 뒤 **정답까지** 걸린 시간. 힌트를 안 봤거나 건너뛰었으면 없다.
   *
   * 힌트 사용률만으로는 힌트가 구조대인지 지름길인지 알 수 없다. 이 값이
   * 짧으면 초성만 보면 바로 떠오른다는 뜻이고(회상은 되는데 실마리가 부족),
   * 길면 초성을 보고도 모른다는 뜻이다(그 지역을 아예 모름).
   */
  hintToAnswerMs?: number;
}

export interface GameState {
  config: ModeConfig;
  items: GameItem[];
  index: number;
  status: GameStatus;
  /** 현재 입력 버퍼 (IME 조합 중 문자열 포함) */
  input: string;
  startedAt: number;
  endedAt: number | null;
  /** 오답 누적으로 차감된 시간 (제한 시간에서 깎인다) */
  penaltyMs: number;
  /**
   * 힌트로 누적된 시간. penaltyMs와 따로 두는 이유는 쓰임이 다르기 때문이다 —
   * 이쪽은 제한 시간이 아니라 최종 기록에 더해진다. 한 통에 담으면
   * 타임어택에서 오답이 시간도 깎고 기록도 늘리는 이중 처벌이 된다.
   */
  hintPenaltyMs: number;
  itemStartedAt: number;
  itemErrors: number;
  /** 마지막으로 기록한 입력의 타수 — 증분 계산용 */
  lastKeystrokeCount: number;
  /** 현재 항목에서 이미 정답 경로를 벗어난 상태인지 — 오류 중복 집계 방지 */
  offTrack: boolean;
  /** 지금 항목에 제출한 오답들 */
  itemWrong: string[];
  /**
   * 마지막으로 오답을 제출한 시각. 화면이 흔들리고 소리가 나는 신호다.
   * 다음 제출까지 그대로 남는다 — 같은 값이면 같은 사건이다.
   */
  rejectedAt: number | null;
  /**
   * 포기한 직후 보여 줄 정답.
   *
   * 모르겠다고 넘어갈 때 아무것도 안 알려주면, 알고 싶어진 바로 그 순간에
   * 아무 일도 일어나지 않는다. 회상 게임에서 그 순간이 가장 배우기 좋다.
   */
  revealed: { answer: string } | null;
  /**
   * 공개된 정답을 따라 치는 중인 입력.
   *
   * 본 입력(input)과 따로 두는 이유는 이 타건이 **점수와 아무 관계가 없어야**
   * 하기 때문이다. 이건 회상이 아니라 베껴 쓰기이고, 여기서 친 것이 타수에
   * 들어가면 모르는 곳을 넘길수록 타수가 오른다.
   */
  revealInput: string;
  /** 지금 항목의 초성 힌트를 봤는지 */
  hintShown: boolean;
  /** 지금 항목의 힌트를 연 시각. 안 열었으면 null. */
  hintShownAt: number | null;
  /** 이번 판에서 초성 힌트를 쓴 횟수 */
  hintsUsed: number;
  keystrokes: Keystroke[];
  results: ItemResult[];
}

export interface Score {
  /** 분당 타수 */
  cpm: number;
  /**
   * 정확도 0~1. **끝낸 곳 중 한 번에 맞힌 비율**이다.
   *
   * 이 게임의 단위는 타수가 아니라 곳이다. 타수로 재면 긴 이름을 틀린 것이
   * 짧은 이름을 틀린 것보다 더 깎이는데, `서귀포시`를 틀린 것이 `중구`를
   * 틀린 것보다 나쁠 이유가 없다.
   */
  accuracy: number;
  elapsedMs: number;
  correctKeystrokes: number;
  totalErrors: number;
  completed: number;
  total: number;
  /** 초성 힌트를 쓴 횟수 */
  hintsUsed: number;
  /**
   * 그중 기록에 얹힌 시간(ms).
   *
   * `elapsedMs`에 이미 들어 있다. 그런데도 따로 들고 다니는 이유는 **화면이
   * 뺄셈을 보여 줘야 하기 때문**이다 — 1분 40초에 끝냈는데 4분 10초가 뜨면
   * 읽을 방법이 없다.
   */
  hintPenaltyMs: number;
  /** 첫 제출에 맞힌 항목 수. 정확도는 이 값을 끝낸 곳 수로 나눈 것이다. */
  firstTry: number;
}
