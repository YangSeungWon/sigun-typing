"use client";

import { getDeviceId } from "../score/client";
import { ENTRY_SOURCES, EXPERIMENT, REVISION, type GameEvent } from "./events";

/**
 * 이벤트를 모아 보낸다.
 *
 * 타건 중에 요청을 날리면 게임 손맛을 해친다. 큐에 쌓았다가 잠깐 조용해지면
 * 보내고, 페이지를 떠날 때는 sendBeacon으로 넘긴다 — 일반 fetch는 문서가
 * 사라지면 취소되므로 game_quit이 가장 필요한 순간에 유실된다.
 */
const FLUSH_DELAY_MS = 3_000;
const MAX_QUEUE = 40;

let queue: GameEvent[] = [];
/**
 * 아직 끝나지 않은 판. 끝내지 않고 떠나면 이게 game_quit이 된다.
 * 이탈을 세는 유일한 방법이라, 판이 끝나면 반드시 비워야 헛된 이탈이 안 찍힌다.
 */
let openRun: GameEvent | null = null;
/** 지금 진행 중인 판의 식별자. game_start에서 새로 만든다. */
let gameId: string | null = null;
/** 이 판이 시작된 시각. 이벤트마다 판 기준 경과 시간을 붙이는 데 쓴다. */
let runStartedAt: number | null = null;
/** 이 판이 개발·QA 트래픽인지. 연습(오답 복습)판도 여기 포함한다. */
let internal = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function payload(events: GameEvent[]): string {
  return JSON.stringify({ deviceId: getDeviceId(), events });
}

function flush(useBeacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;

  const body = payload(queue);
  queue = [];

  try {
    if (useBeacon && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
      // false는 브라우저가 안 받아 줬다는 뜻이다(큐 한도·크기 초과 등).
      // 큐는 이미 비웠으므로 여기서 포기하면 그 이탈은 영영 사라진다.
      if (sent) return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 계측 실패가 게임을 방해해서는 안 된다.
  }
}

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  // visibilitychange가 pagehide보다 신뢰도가 높다. 모바일에서 특히 그렇다.
  const leave = () => {
    // 반드시 track()을 거쳐야 한다. 큐에 직접 넣으면 실험 버전·gameId·경과
    // 시간이 빠진 채로 남아, 이탈이 어느 실험의 몇 번째 판이었는지 알 수
    // 없게 된다 — 하필 퍼널의 분모가 되는 이벤트다.
    abandonRunTracking();
    flush(true);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") leave();
  });
  window.addEventListener("pagehide", leave);
}

export function track(event: GameEvent) {
  if (typeof window === "undefined") return;
  listen();
  // 실험 버전·판 식별자·내부 여부는 빠짐없이 붙어야 한다.
  // 하나라도 빠지면 그 이벤트는 해석할 수 없다.
  queue.push({
    id: crypto.randomUUID(),
    experiment: EXPERIMENT,
    revision: REVISION,
    ...(gameId ? { gameId } : {}),
    ...(runStartedAt !== null ? { atMs: Date.now() - runStartedAt } : {}),
    ...(internal ? { internal: true } : {}),
    ...event,
  });
  if (queue.length >= MAX_QUEUE) return flush();
  if (!timer) timer = setTimeout(() => flush(), FLUSH_DELAY_MS);
}

/** 지금 당장 보낸다. 판이 끝난 직후처럼 유실되면 곤란한 시점에 쓴다. */
export function flushEvents() {
  flush();
}

/** 판이 시작됐다. 여기서부터 이탈이 집계된다. */
export function openRunTracking(base: Omit<GameEvent, "name">) {
  listen();
  openRun = { ...base, name: "game_quit", progress: 0 };
}

/**
 * 새 판이 시작됐다. 이 판의 모든 이벤트가 같은 gameId로 묶인다.
 * @param isInternal 개발·QA·연습 판이면 true
 */
export function beginGame(isInternal = false) {
  gameId = crypto.randomUUID();
  runStartedAt = Date.now();
  internal = isInternal || isInternalTraffic();
}

/**
 * 개발·QA에서 온 트래픽인지.
 *
 * 배포 시각으로 거르는 방법은 실험마다 그 시각을 기억해야 한다.
 * 접속한 주소를 보고 판단하면 그럴 필요가 없다.
 */
function isInternalTraffic(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  );
}

export function setRunProgress(progress: number) {
  if (openRun) openRun.progress = progress;
}

/** 끝까지 갔다. 이탈로 세지 않는다. */
export function finishRunTracking(event: Omit<GameEvent, "name">) {
  openRun = null;
  track({ ...event, name: "game_finish" });
  // 결과 화면에서 바로 떠나는 사람이 많으므로 미루지 않는다.
  flush();
}

/** 끝내지 않고 화면을 벗어났다. */
export function abandonRunTracking() {
  if (!openRun) return;
  track(openRun);
  openRun = null;
}

/**
 * 이 판을 시작하게 만든 화면. 링크의 `?from=`으로 전달된다.
 *
 * useSearchParams 대신 주소를 직접 읽는다 — 이 값은 사용자가 출발을 누른
 * 뒤에만 필요하므로 렌더와 무관하고, 훅을 쓰면 정적 페이지에 Suspense
 * 경계가 강제된다.
 */
export function entrySource(): string {
  if (typeof window === "undefined") return "direct";
  const from = new URLSearchParams(window.location.search).get("from");
  return from && (ENTRY_SOURCES as readonly string[]).includes(from) ? from : "direct";
}

/**
 * 주소에 실려 온 도전 정보. `?beat=<ms>&by=<이름>`
 *
 * 서버에 남기지 않는 이유: 도전 카드 하나 만들자고 남의 기록과 이름을 쌓을
 * 이유가 없다. 이 값은 화면 문구일 뿐 순위에 관여하지 않으므로, 고쳐 봐야
 * 자기 화면의 목표 시간만 바뀐다.
 */
export function readChallenge(): { beatMs: number; by: string | null } | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const beat = Number(q.get("beat"));
  // 하루가 넘는 기록은 장난이다.
  if (!Number.isFinite(beat) || beat <= 0 || beat > 86_400_000) return null;
  const by = q.get("by");
  return {
    beatMs: Math.floor(beat),
    by: by ? by.replace(/[\p{C}]/gu, "").trim().slice(0, 12) || null : null,
  };
}
