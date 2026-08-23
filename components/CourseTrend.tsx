"use client";

import { useMemo, useState } from "react";
import type { ModeId } from "@/lib/game/types";
import { MODE_LABELS } from "@/lib/game/modes";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { loadRuns, runsOf, type RunRecord } from "@/lib/score/history";
import { formatClock } from "./Odometer";
import { Sparkline } from "./Sparkline";

/**
 * 이 코스에서 내가 어떻게 움직였나.
 *
 * 기록 탭의 줄과 같은 값을 쓰되 더 크게 그린다. 거기서는 여러 코스를 훑어보는
 * 자리라 한 줄이 맞고, 여기는 **이 코스 하나**를 시작하기 직전이라 자기 흐름이
 * 보일 만큼은 커도 된다.
 *
 * 시작 단추 **아래**에 둔다. 위에 두면 처음 온 사람이 아무것도 없는 자리를
 * 지나야 시작 단추에 닿는다 — 이 화면이 먼저 해야 할 일은 판을 여는 것이다.
 */

/** 점이 이보다 적으면 곡선이 아니라 점이다. */
const MIN_POINTS = 3;

export function CourseTrend({ courseId }: { courseId: string }) {
  // 기록은 기기에만 있다. 서버는 모르므로 하이드레이션 뒤에 읽는다.
  const hydrated = useIsHydrated();
  const [loaded, setLoaded] = useState(false);
  // 서버 렌더에는 기록이 없다. 하이드레이션 뒤에 채운다.
  const [runs, setRuns] = useState<RunRecord[]>([]);
  if (hydrated && !loaded) {
    setLoaded(true);
    setRuns(loadRuns());
  }

  const lines = useMemo(() => {
    const modes: ModeId[] = ["map", "learn"];
    return modes.flatMap((mode) => {
      // 다 돈 판만 견준다. 스무 곳만 치고 빠른 것은 빠른 것이 아니다.
      const done = runsOf(runs, courseId, mode).filter((r) => r.completed === r.total);
      if (done.length < MIN_POINTS) return [];
      const times = done.map((r) => r.elapsedMs);
      return [{ mode, times, best: Math.min(...times), latest: times.at(-1)! }];
    });
  }, [runs, courseId]);

  if (lines.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {/*
        제목을 달지 않는다. 카드가 모드 이름과 판수와 기록과 곡선을 이미
        말하고 있어, 그 위에 얹는 말은 무엇을 보고 있는지를 한 번 더 부르는
        것뿐이다. 아래 `지역 목록 보기`도 제목 없이 선다.
      */}
      {lines.map((l) => (
        <div
          key={l.mode}
          className="flex flex-col gap-3 rounded-xl border border-concrete-deep px-5 py-4"
        >
          <div className="flex items-baseline justify-between gap-4 font-mono text-sm">
            <span className="flex items-baseline gap-3">
              <span className="text-dim">{MODE_LABELS[l.mode]}</span>
              <span className="text-dim">{l.times.length}판</span>
            </span>
            <span className="flex items-baseline gap-3">
              <span className="tabular-nums">{formatClock(l.latest)}</span>
              <span className="text-dim">최고 {formatClock(l.best)}</span>
            </span>
          </div>
          {/*
            폭은 화면을 따라가고 높이는 고정이다. 세로로 늘리면 작은 차이가
            산맥처럼 보여 실제보다 널뛴 것처럼 읽힌다.
          */}
          <Sparkline times={l.times} className="h-16 w-full" />
        </div>
      ))}
    </section>
  );
}
