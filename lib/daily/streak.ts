import { readJson, writeJson } from "../storage";

/**
 * 며칠째 이어서 오고 있는가.
 *
 * 하루에 한 번인 게임에서 다시 오게 만드는 장치다. 오늘 풀 이유는 오늘 문제가
 * 궁금해서지만, **내일 올 이유**는 끊고 싶지 않은 숫자가 만든다.
 *
 * ── 무엇을 세는가 ───────────────────────────────────────────
 * **푼 날**을 센다. 맞힌 날이 아니다.
 *
 * 워들은 연속 정답을 세고 한 번 틀리면 끊는다. 여기서 그러면 가혹하다 —
 * 229곳 중 하나라 낯선 군이 나오는 날이 반드시 있고, 그런 날 하나가 두 달치를
 * 지우면 그 사람은 다시 안 온다. 못 맞혀도 왔으면 온 것이다.
 *
 * 끊기는 조건은 하나뿐이다. **안 온 날.**
 *
 * 맞힌 날은 따로 센다. 그건 연속이 아니라 총계라 하루 못 맞혔다고 줄지 않는다.
 */

const KEY = "sigun:daily-streak:v1";

export interface Streak {
  /** 지금 이어지고 있는 날 수. */
  current: number;
  /** 여태 가장 길었던 연속. */
  best: number;
  /** 마지막으로 끝낸 날의 일차. 이어지는지 끊겼는지를 이 값으로 판단한다. */
  lastDay: number;
  /** 끝낸 날 수. */
  played: number;
  /** 맞힌 날 수. */
  solved: number;
}

const EMPTY: Streak = { current: 0, best: 0, lastDay: -1, played: 0, solved: 0 };

function accept(raw: unknown): Streak | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const nums = ["current", "best", "lastDay", "played", "solved"] as const;
  if (!nums.every((k) => typeof v[k] === "number")) return null;
  return {
    current: v.current as number,
    best: v.best as number,
    lastDay: v.lastDay as number,
    played: v.played as number,
    solved: v.solved as number,
  };
}

export function loadStreak(): Streak {
  return readJson(KEY, accept) ?? EMPTY;
}

/**
 * 오늘 판이 끝났다.
 *
 * 같은 날 두 번 불러도 한 번만 센다 — 화면이 다시 그려질 때마다 숫자가 오르면
 * 그건 기록이 아니다.
 */
export function recordDay(day: number, solved: boolean, at: Streak = loadStreak()): Streak {
  if (at.lastDay === day) return at;

  const continued = at.lastDay === day - 1;
  const current = continued ? at.current + 1 : 1;
  const next: Streak = {
    current,
    best: Math.max(at.best, current),
    lastDay: day,
    played: at.played + 1,
    solved: at.solved + (solved ? 1 : 0),
  };
  writeJson(KEY, next);
  return next;
}

/**
 * 오늘 기준으로 이어지고 있는가.
 *
 * 저장된 `current`는 마지막으로 푼 날의 값이다. 이틀 쉬었으면 그 값은 그대로
 * 남아 있지만 지금은 끊긴 상태다 — 어제까지 푼 사람에게만 살아 있다.
 */
export function aliveOn(streak: Streak, day: number): number {
  if (streak.lastDay === day || streak.lastDay === day - 1) return streak.current;
  return 0;
}
