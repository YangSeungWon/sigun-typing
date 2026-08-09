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
  const cpm = best ? Math.round(best.cpm) : null;

  useEffect(() => {
    if (cpm === null) return;
    let alive = true;
    const params = new URLSearchParams({ course: courseId, mode, cpm: String(cpm) });
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
  }, [courseId, mode, cpm]);

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
            cpm={entry.cpm}
            elapsedMs={entry.elapsedMs}
          />
        ))}
        <Row
          mine
          rank={around.rank}
          name="내 기록"
          cpm={best.cpm}
          elapsedMs={best.elapsedMs}
        />
        {around.below.map((entry, i) => (
          <Row
            key={entry.id}
            rank={around.rank + i + 1}
            name={entry.nickname}
            cpm={entry.cpm}
            elapsedMs={entry.elapsedMs}
          />
        ))}
      </ol>
      {around.above[around.above.length - 1] && (
        <p className="font-mono text-sm text-dim">
          바로 위와{" "}
          <span className="text-ink">
            {Math.max(1, Math.round(around.above[around.above.length - 1].cpm - best.cpm))}
            타/분
          </span>{" "}
          차이
        </p>
      )}
    </section>
  );
}

function Row({
  rank,
  name,
  cpm,
  elapsedMs,
  mine = false,
}: {
  rank: number;
  name: string;
  cpm: number;
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
        <span className={mine ? "text-sign" : ""}>{name}</span>
      </span>
      <span className="font-mono text-sm tabular-nums text-dim">
        {Math.round(cpm)}타/분 · {formatClock(elapsedMs)}
      </span>
    </li>
  );
}
