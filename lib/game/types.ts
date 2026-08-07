export type ModeId = "single" | "timeattack" | "quiz" | "memorize" | "multi";

/** 코스에 담긴 한 항목 — 보통 하나의 시·군·구. */
export interface GameItem {
  /** 행정구역 코드 등 안정적인 식별자 */
  id: string;
  /** 정답으로 표시할 표준 표기 (예: "수원") */
  answer: string;
  /** 함께 정답으로 인정할 표기 (예: "수원시") */
  aliases?: string[];
  /** 퀴즈 모드에서 보여줄 단서 */
  hint?: string;
}

export interface ModeConfig {
  id: ModeId;
  /** 정답을 화면에 보여줄지. false면 지도만 보고 떠올려야 한다. */
  reveal: boolean;
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
  /** 정답 경로를 벗어난 횟수 */
  errors: number;
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
  itemKeystrokes: number;
  itemErrors: number;
  /** 마지막으로 기록한 입력의 타수 — 증분 계산용 */
  lastKeystrokeCount: number;
  /** 현재 항목에서 이미 정답 경로를 벗어난 상태인지 — 오류 중복 집계 방지 */
  offTrack: boolean;
  /**
   * 포기한 직후 보여 줄 정답.
   *
   * 모르겠다고 넘어갈 때 아무것도 안 알려주면, 알고 싶어진 바로 그 순간에
   * 아무 일도 일어나지 않는다. 회상 게임에서 그 순간이 가장 배우기 좋다.
   */
  revealed: { answer: string; until: number } | null;
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
  /** 정확도 0~1 */
  accuracy: number;
  elapsedMs: number;
  correctKeystrokes: number;
  totalErrors: number;
  completed: number;
  total: number;
  /** 초성 힌트를 쓴 횟수 */
  hintsUsed: number;
}
