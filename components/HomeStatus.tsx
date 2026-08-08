"use client";

import Link from "next/link";
import { COURSES } from "@/data/courses";
import { loadAllMistakes } from "@/lib/score/mistakes";
import { loadPersonalBest } from "@/lib/score/personalBest";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { formatClock } from "./Odometer";

/**
 * 다시 온 사람의 홈.
 *
 * 첫 방문 홈과 스무 번째 방문 홈이 같으면 아깝다. 처음 온 사람에게 필요한
 * 것은 "이게 무슨 게임인가"이고, 다시 온 사람에게 필요한 것은 "내가 어디까지
 * 했더라"다. 기록이 없으면 아무것도 그리지 않는다 — 첫 방문자에게 빈 상자를
 * 보여 줄 이유가 없다.
 *
 * 인삿말은 넣지 않는다. 다시 왔다는 사실은 본인이 안다.
 */
export function HomeStatus() {
  const hydrated = useIsHydrated();
  if (!hydrated) return null;

  // 기록은 기기에만 있다. 서버는 이 값을 모른다.
  const best = COURSES.map((course) => ({
    course,
    record: loadPersonalBest(course.id, "map", course.version),
  }))
    .filter((entry) => entry.record !== null)
    .sort((a, b) => (b.record!.achievedAt ?? 0) - (a.record!.achievedAt ?? 0))[0];

  const mistakes = loadAllMistakes(COURSES.map((c) => c.id));
  const stuck = mistakes.reduce((n, group) => n + group.records.length, 0);

  if (!best && stuck === 0) return null;

  return (
    <section className="flex flex-wrap gap-3">
      {best && (
        <Link
          href={`/play/map/${best.course.id}?from=home_challenge`}
          className="flex flex-1 flex-col gap-1 rounded-xl border border-concrete-deep bg-paint/60 px-5 py-4 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="font-mono text-xs tracking-[0.18em] text-dim uppercase">
            {best.course.name} 최고 기록
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {formatClock(best.record!.elapsedMs)}
          </span>
          <span className="text-sm text-dim">기록 깨기 →</span>
        </Link>
      )}

      {stuck > 0 && (
        <Link
          href="/notes"
          className="flex flex-1 flex-col gap-1 rounded-xl border border-concrete-deep bg-paint/60 px-5 py-4 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="font-mono text-xs tracking-[0.18em] text-dim uppercase">
            헷갈리는 지역
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {stuck}곳
          </span>
          <span className="text-sm text-dim">다시 보기 →</span>
        </Link>
      )}
    </section>
  );
}
