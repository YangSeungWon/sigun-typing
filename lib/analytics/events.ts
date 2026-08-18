/**
 * 계측 이벤트.
 *
 * 답하려는 질문은 하나다 — 사람들이 **지도 회상의 부담 때문에** 나가는가,
 * 아니면 그냥 흥미가 없어서 나가는가.
 *
 * 그래서 `game_start → first_correct` 구간이 가장 중요하다. 이 구간에서
 * 크게 빠지면 콘텐츠가 아니라 첫 문제의 난도가 문제다. 완주율만 보면
 * 이 둘을 구분할 수 없다.
 */
export const EVENT_NAMES = [
  /** 홈에 도달했다 */
  "home_view",
  /** 코스 선택 화면에서 코스를 열었다 */
  "course_view",
  /** 출발했다 */
  "game_start",
  /** 첫 항목을 맞혔다 — 회상 부담을 넘겼다는 신호 */
  "first_correct",
  /** 초성 힌트를 열었다. progress=0이 많으면 사람들은 힌트로 게임을 우회하는 중이다 */
  "hint_used",
  /**
   * 힌트를 본 항목을 끝냈다. elapsedMs가 힌트에서 정답까지 걸린 시간이다.
   *
   * 힌트 사용률만으로는 힌트가 구조대인지 지름길인지 알 수 없다. 짧으면
   * 초성만 보면 떠오르는 것이고, 길면 초성을 봐도 모르는 것이다 — 전자는
   * 실마리를 늘릴 문제, 후자는 코스 난도를 낮출 문제다.
   */
  "hint_resolved",
  /** 25·50·75% 지점을 지났다 */
  "game_progress",
  /** 끝까지 갔다 */
  "game_finish",
  /** 끝내지 않고 떠났다 */
  "game_quit",
  /** 결과 화면에서 다른 모드로 넘어갔다 */
  "mode_switch",
  /** 결과를 도전장으로 내보냈다 — 이 게임이 퍼지는 유일한 통로 */
  "share_clicked",

  /*
   * 대결 퍼널.
   *
   * 답하려는 질문은 하나다 — 대결이 안 쓰이는 것이 **길이 안 보여서**인가,
   * **혼자라서**인가. 아흐레 동안 대결 기록이 0건이었는데, 그게 아무도 대결
   * 화면에 닿지 않아서인지 닿았지만 부를 사람이 없어서인지를 지금은 가를 수
   * 없다. 답이 갈려야 다음이 정해진다 — 앞쪽이면 입구 문제이고, 뒤쪽이면
   * 빠른 참가나 공개방 같은 것이 필요하다는 뜻이다.
   *
   * versus_view → versus_create → versus_start(total≥2)가 그 퍼널이다.
   * 만들었는데 출발이 없거나 늘 total=1이면 혼자 기다리다 나간 것이다.
   */

  /** 대결 화면에 도달했다 */
  "versus_view",
  /** 방을 만들었다 */
  "versus_create",
  /** 남의 방에 들어갔다. 코드를 받았거나 링크를 눌렀다 */
  "versus_join",
  /** 실제로 출발했다. total이 그때 방에 있던 사람 수다 — 이게 성사 여부다 */
  "versus_start",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/**
 * 실험 버전. 입구 구조나 카피를 바꾸면 올린다.
 *
 * SCORING_VERSION과 목적이 다르다 — 그쪽은 기록끼리 비교 가능한지를 가르고,
 * 이쪽은 **어떤 화면을 본 사람들의 행동인지**를 가른다. 문구 하나만 바꿔도
 * 퍼널이 흔들리므로, 섞이면 그 뒤로는 해석이 불가능해진다.
 *
 * typing-first-v1: 이름을 보고 따라 치는 모드를 입구로 둔 구조. 폐기.
 *   답이 적혀 있는데 지도가 그 지역을 문제처럼 가리켜, 무엇을 맞히는
 *   게임인지 알 수 없었다. 지도가 장식이 되면서 시군을 소재로 쓰는
 *   이유 자체가 흐려졌다.
 *
 * map-recall-v1: 지도 회상을 본편으로 두고, 진입장벽은 쉬운 첫 코스와
 *   초성 힌트로 낮춘다. 검증할 질문이 "따라치기가 대중적인가"에서
 *   "회상 부담을 얼마나 낮출 수 있는가"로 바뀌었다.
 */
export const EXPERIMENT = "map-recall-v1";

/**
 * 지금 돌고 있는 화면의 판번호. 빌드할 때 박힌다.
 *
 *   UI_REVISION=$(git rev-parse --short HEAD) docker compose build web
 *
 * 안 넣고 빌드해도 게임은 돌아간다. 다만 그 배포의 숫자는 `dev`로 뭉쳐
 * 나중에 가를 수 없다.
 */
export const REVISION = process.env.NEXT_PUBLIC_UI_REVISION || "dev";

/** game_start를 유발한 화면. 결과 화면 CTA의 전환율을 따로 보려면 필요하다. */
export const ENTRY_SOURCES = [
  "home_primary",
  /** 홈에서 한 문제를 풀고 이어서 시작했다 */
  "home_hero",
  "home_secondary",
  "home_challenge",
  "course_select",
  "result_cta",
  /** 이용안내를 읽고 시작했다. 설명이 필요한 사람이 얼마나 되는지 본다 */
  "guide",
  /** 남의 도전장을 받고 들어왔다. share_clicked와 짝이 되어 고리를 완성한다 */
  "challenge",
  "direct",
] as const;

export type EntrySource = (typeof ENTRY_SOURCES)[number];

export function isEntrySource(value: unknown): value is EntrySource {
  return typeof value === "string" && (ENTRY_SOURCES as readonly string[]).includes(value);
}

export interface GameEvent {
  name: EventName;
  /**
   * 이 이벤트 하나를 가리키는 값. 클라이언트가 만든다.
   *
   * 같은 묶음이 두 번 도착할 수 있다 — beacon은 보냈는지 확인할 방법이 없고,
   * 중간의 프록시가 다시 보낼 수도 있다. 그때 판 하나가 두 판으로 세어지면
   * 퍼널이 조용히 틀린다. 서버는 이 값이 겹치면 그냥 버린다.
   */
  id?: string;
  /**
   * 판이 시작된 뒤 흐른 시간(ms).
   *
   * **믿을 수 없는 값이다.** 기기가 보내 준 숫자이고 얼마든지 조작할 수 있다.
   * 퍼널 분석에만 쓰고, 점수·랭킹 검증에는 절대 쓰지 않는다 — 그쪽은
   * 서버가 발급한 토큰 시각과 타건 기록 재생으로만 판단한다(lib/score).
   *
   * created_at으로는 이걸 대신할 수 없다. 이벤트는 3초 단위로 모아 보내므로
   * 한 묶음의 created_at이 거의 같아진다 — `game_start → first_correct`가
   * 전부 0초로 찍힌다. 시간을 재려면 클라이언트가 찍어 보내야 한다.
   */
  atMs?: number;
  /**
   * 한 판을 묶는 값. 이게 없으면 새로고침이나 중복 전송 때문에
   * 퍼널의 분모가 흔들린다 — 한 사람이 30판 한 것과 30명이 한 판씩 한 것을
   * 구분할 수 없게 된다.
   */
  gameId?: string;
  courseId?: string;
  mode?: string;
  /** 이 시점까지 확정한 항목 수 */
  progress?: number;
  total?: number;
  elapsedMs?: number;
  hintCount?: number;
  /** mode_switch에서 넘어간 목적지 */
  toMode?: string;
  /** game_start를 유발한 화면 */
  source?: string;
  /** 이 이벤트가 속한 실험 버전 */
  experiment?: string;
  /**
   * 이 이벤트가 나온 화면의 판번호.
   *
   * 화면을 계속 고치면서도 숫자를 볼 수 있게 하는 유일한 장치다. 판번호가
   * 없으면 "어느 화면에서 첫 정답 이탈이 높았는가"를 영영 가를 수 없어,
   * 결국 데이터를 기다리느라 개선을 멈추게 된다. 붙여 두면 계속 고쳐도 된다.
   *
   * 실험 버전(experiment)과 다르다 — 그쪽은 가설이 바뀔 때만 올리고,
   * 이쪽은 배포할 때마다 바뀐다.
   */
  revision?: string;
  /**
   * 사람이 아니거나 사람이어도 세면 안 되는 트래픽. 분석에서 항상 뺀다.
   *
   * 두 가지가 여기 얹힌다. 하나는 개발·QA — 접속 주소로 판단하므로 배포
   * 시각을 매 실험마다 기억할 필요가 없다. 다른 하나는 봇 — 서버가
   * User-Agent와 기기 갈아 끼우기로 가려 표를 단다(lib/analytics/bots.ts).
   *
   * 둘을 한 표로 묶는 이유는 쓰임이 같기 때문이다. 어느 쿼리에서도 "이건
   * 빼고"이지 "개발은 빼고 봇은 넣고"인 적이 없다.
   */
  internal?: boolean;
}

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}

/** 서버가 받아 저장할 수 있는 형태인지. 숫자는 음수·비정상 값을 잘라 낸다. */
export function sanitizeEvent(raw: unknown): GameEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (!isEventName(e.name)) return null;

  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.min(Math.floor(n), 10_000_000);
  };
  const str = (v: unknown, max: number): string | undefined =>
    typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;

  return {
    name: e.name,
    id: str(e.id, 64),
    atMs: num(e.atMs),
    courseId: str(e.courseId, 40),
    mode: str(e.mode, 20),
    progress: num(e.progress),
    total: num(e.total),
    elapsedMs: num(e.elapsedMs),
    hintCount: num(e.hintCount),
    toMode: str(e.toMode, 20),
    source: isEntrySource(e.source) ? e.source : undefined,
    experiment: str(e.experiment, 40),
    revision: str(e.revision, 40),
    gameId: str(e.gameId, 64),
    internal: e.internal === true ? true : undefined,
  };
}
