"use client";

import Link from "next/link";
import { useMemo } from "react";
import { COURSES } from "@/data/courses";
import { MODE_LABELS } from "@/lib/game/modes";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { loadRuns, runsOf, type RunRecord } from "@/lib/score/history";
import { formatClock } from "./Odometer";
import { Sparkline } from "./Sparkline";

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
          <li key={`${c.courseId}:${c.mode}`}>
            {/*
              눌러서 그 코스로 간다.

              여태 보기만 하는 목록이었다. `서울 25개 구를 여섯 판 했고 늘고
              있다`를 본 사람이 다음에 하고 싶은 일은 하나뿐인데, 그 자리에서
              갈 길이 없어 목록을 되짚어 나가야 했다.

              판을 바로 시작하지는 않는다. 코스 화면에는 같은 곡선이 더 크게
              있고 모드를 고를 수도 있다 — 누르자마자 시계가 도는 것은 이 자리가
              부를 만한 일이 아니다.
            */}
            <Link
              href={`/courses/${c.courseId}`}
              className="flex items-center gap-4 rounded-xl border border-concrete-deep px-5 py-4 transition-colors hover:border-dim hover:bg-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{c.courseName}</span>
                <span className="flex items-baseline gap-3 font-mono text-sm text-dim">
                  <span>{c.mode}</span>
                  <span>{c.runs.length}판</span>
                </span>
              </span>
              <Sparkline
                times={c.runs.map((r) => r.elapsedMs)}
                className="h-8 w-24 shrink-0"
              />
              <span className="flex flex-col items-end gap-0.5 font-mono text-sm">
                <span className="tabular-nums">{formatClock(c.latest)}</span>
                <span className="text-dim">최고 {formatClock(c.best)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
