"use client";

import { useEffect, useState } from "react";
import type { ModeId } from "@/lib/game/types";
import type { LeaderboardEntry } from "@/lib/db/repo";
import { loadPersonalBest } from "@/lib/score/personalBest";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { formatClock } from "./Odometer";

interface MyStandingProps {
  courseId: string;
  courseVersion: number;
  mode: ModeId;
}

interface Around {
  rank: number;
  total: number;
  above: LeaderboardEntry[];
  below: LeaderboardEntry[];
}

/**
 * 내 주변 순위.
 *
 * 상위 열 명만 보면 새로 온 사람은 아무 감정이 없다 — 1위가 18초, 나는 2분.
 * 바로 위 한 줄이 보여야 "저건 따라잡겠는데"가 생긴다.
 *
 * 내 기록은 기기에만 있으므로 서버가 이 화면을 그릴 수 없다. 개인 기록을
 * 읽어 그 값으로 언저리를 물어본다.
 */
export function MyStanding({ courseId, courseVersion, mode }: MyStandingProps) {
  const hydrated = useIsHydrated();
  const [around, setAround] = useState<Around | null>(null);
  const best = hydrated ? loadPersonalBest(courseId, mode, courseVersion) : null;
  // 순위 기준과 같은 값으로 물어본다 — 많이 끝낸 쪽이 먼저, 같으면 빠른 쪽.
  const completed = best?.completed ?? null;
  const elapsedMs = best?.elapsedMs ?? null;

  useEffect(() => {
    if (completed === null || elapsedMs === null) return;
    let alive = true;
    const params = new URLSearchParams({
      course: courseId,
      mode,
      completed: String(completed),
      elapsed: String(elapsedMs),
    });
    fetch(`/api/scores/standing?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && typeof data.rank === "number") setAround(data);
      })
      .catch(() => {
        // 순위를 못 읽어도 순위표 본문은 그대로 보인다.
      });
    return () => {
      alive = false;
    };
  }, [courseId, mode, completed, elapsedMs]);

  // 아직 이 코스를 해 보지 않았다면 보여 줄 것이 없다.
  if (!best || !around || around.total === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-concrete-deep bg-paint/60 p-5">
      <h2 className="font-mono text-sm tracking-[0.18em] text-dim uppercase">
        내 주변
      </h2>
      <ol className="flex flex-col">
        {around.above.map((entry, i) => (
          <Row
            key={entry.id}
            rank={around.rank - around.above.length + i}
            name={entry.nickname}
            completed={entry.completed}
            total={entry.total}
            elapsedMs={entry.elapsedMs}
          />
        ))}
        <Row
          mine
          rank={around.rank}
          name="내 기록"
          completed={best.completed}
          total={best.total}
          elapsedMs={best.elapsedMs}
        />
        {around.below.map((entry, i) => (
          <Row
            key={entry.id}
            rank={around.rank + i + 1}
            name={entry.nickname}
            completed={entry.completed}
            total={entry.total}
            elapsedMs={entry.elapsedMs}
          />
        ))}
      </ol>
      {/*
        바로 위와의 차이. 같은 수를 끝냈으면 시간으로, 아니면 곳 수로 말한다 —
        순위를 가른 그 값을 그대로 보여 줘야 따라잡을 거리가 읽힌다.
      */}
      {around.above[around.above.length - 1] && (
        <Gap ahead={around.above[around.above.length - 1]} mine={best} />
      )}
    </section>
  );
}

/**
 * 바로 위와의 거리.
 *
 * 순위를 가른 값을 그대로 말한다 — 끝낸 곳 수가 다르면 곳 수로, 같으면 시간으로.
 * "몇 타/분 차이"는 이제 순위와 상관없는 숫자다.
 */
function Gap({
  ahead,
  mine,
}: {
  ahead: { completed: number; elapsedMs: number };
  mine: { completed: number; elapsedMs: number };
}) {
  const places = ahead.completed - mine.completed;
  return (
    <p className="font-mono text-sm text-dim">
      바로 위와{" "}
      <span className="text-ink">
        {places > 0
          ? `${places}곳`
          : formatClock(Math.max(1000, mine.elapsedMs - ahead.elapsedMs))}
      </span>{" "}
      차이
    </p>
  );
}

function Row({
  rank,
  name,
  completed,
  total,
  elapsedMs,
  mine = false,
}: {
  rank: number;
  name: string;
  completed: number;
  total: number;
  elapsedMs: number;
  mine?: boolean;
}) {
  return (
    <li
      className={`flex items-baseline justify-between gap-4 rounded-lg px-3 py-2 ${
        mine ? "bg-sign/15 font-semibold" : ""
      }`}
    >
      <span className="flex items-baseline gap-3">
        <span className="font-mono text-sm tabular-nums text-dim">{rank}</span>
        <span className={mine ? "text-sign-deep" : ""}>{name}</span>
      </span>
      <span className="font-mono text-sm tabular-nums text-dim">
        <span>{completed}/{total}</span>
        <span className="ml-3">{formatClock(elapsedMs)}</span>
      </span>
    </li>
  );
}
