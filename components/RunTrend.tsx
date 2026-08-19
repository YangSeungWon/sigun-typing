"use client";

import { useMemo } from "react";
import { COURSES } from "@/data/courses";
import { MODE_LABELS } from "@/lib/game/modes";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { loadRuns, runsOf, type RunRecord } from "@/lib/score/history";
import { formatClock } from "./Odometer";

/**
 * 늘고 있는가.
 *
 * 개인 최고 기록은 값 하나라 "지금 잘하고 있나"에만 답한다. 41초가 첫 판인지
 * 스무 번째인지, 지난주에는 몇 초였는지를 화면이 모른다. 타자 연습이 사람을
 * 붙잡아 두는 힘은 대부분 거기서 나온다 — 오늘 380타, 지난달 310타.
 *
 * 그래서 **줄 하나만 그린다.** 축도 눈금도 없다. 이 화면이 답할 물음은
 * "내려가고 있는가" 하나이고, 그건 선의 모양만으로 읽힌다.
 */

/** 점이 이보다 적으면 곡선이 아니라 점이다. */
const MIN_POINTS = 3;

interface Curve {
  courseId: string;
  courseName: string;
  mode: string;
  runs: RunRecord[];
  best: number;
  latest: number;
}

export function RunTrend() {
  // 기록은 기기에만 있다. 서버는 이 값을 모르므로 하이드레이션 뒤에 읽는다.
  const hydrated = useIsHydrated();
  const curves = useMemo<Curve[]>(() => {
    if (!hydrated) return [];
    const all = loadRuns();
    const names = new Map(COURSES.map((c) => [c.id, c.name]));
    const seen = new Set<string>();
    const out: Curve[] = [];

    for (const r of all) {
      const key = `${r.courseId}:${r.mode}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // 다 돈 판만 견준다. 스무 곳만 치고 빠른 것은 빠른 것이 아니다.
      const runs = runsOf(all, r.courseId, r.mode).filter(
        (x) => x.completed === x.total,
      );
      if (runs.length < MIN_POINTS) continue;

      out.push({
        courseId: r.courseId,
        courseName: names.get(r.courseId) ?? r.courseId,
        mode: MODE_LABELS[r.mode] ?? r.mode,
        runs,
        best: Math.min(...runs.map((x) => x.elapsedMs)),
        latest: runs.at(-1)!.elapsedMs,
      });
    }
    // 최근에 한 것부터. 어제 한 코스가 먼저 보여야 한다.
    return out.sort((a, b) => b.runs.at(-1)!.at - a.runs.at(-1)!.at);
  }, [hydrated]);

  if (curves.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">지나온 기록</h2>
      <ul className="flex flex-col gap-3">
        {curves.map((c) => (
          <li
            key={`${c.courseId}:${c.mode}`}
            className="flex items-center gap-4 rounded-xl border border-concrete-deep px-5 py-4"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{c.courseName}</span>
              <span className="flex items-baseline gap-3 font-mono text-sm text-dim">
                <span>{c.mode}</span>
                <span>{c.runs.length}판</span>
              </span>
            </span>
            <Sparkline runs={c.runs} best={c.best} />
            <span className="flex flex-col items-end gap-0.5 font-mono text-sm">
              <span className="tabular-nums">{formatClock(c.latest)}</span>
              <span className="text-dim">최고 {formatClock(c.best)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 줄 하나.
 *
 * 세로는 시간이고 **아래가 빠른 쪽**이다. 그래서 잘하고 있으면 선이 내려간다 —
 * 사람이 곡선에서 먼저 읽는 것은 숫자가 아니라 기울기다.
 *
 * 가로는 판 순서지 날짜가 아니다. 날짜로 두면 한 달 쉬었다 온 사람의 곡선이
 * 오른쪽 끝에 뭉치고, 이 화면이 답할 물음은 "언제 했나"가 아니라 "늘고 있나"다.
 */
function Sparkline({ runs, best }: { runs: RunRecord[]; best: number }) {
  /*
   * 양옆을 조금 비운다. 끝 점이 viewBox 경계에 걸리면 동그라미가 반만 그려진다 —
   * 하필 그게 마지막 판이라 제일 보여야 할 점이다.
   */
  const W = 96;
  const H = 32;
  const PAD = 4;
  const times = runs.map((r) => r.elapsedMs);
  const max = Math.max(...times);
  const min = Math.min(...times);
  const span = max - min || 1;

  const points = times.map((t, i) => {
    const x = PAD + (i / (times.length - 1)) * (W - PAD * 2);
    // 빠를수록 아래. 값이 작을수록 y가 커진다.
    const y = ((t - min) / span) * (H - 6) + 3;
    return `${x.toFixed(1)},${(H - y).toFixed(1)}`;
  });

  const lastIsBest = times.at(-1) === best;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-8 w-24 shrink-0"
      role="img"
      aria-label={`최근 ${runs.length}판의 기록 흐름`}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--color-sign)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 마지막 판. 최고 기록이면 노랑으로 — 그 판이 무엇이었는지가 곧 다음 판의 이유다. */}
      <circle
        cx={points.at(-1)!.split(",")[0]}
        cy={points.at(-1)!.split(",")[1]}
        r={3}
        fill={lastIsBest ? "var(--color-centerline)" : "var(--color-sign)"}
      />
    </svg>
  );
}
