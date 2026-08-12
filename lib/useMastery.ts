"use client";

import { useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { getCourse } from "@/data/courses";
import { loadMistakes } from "@/lib/score/mistakes";
import { loadPersonalBest } from "@/lib/score/personalBest";
import { useIsHydrated } from "@/lib/useIsHydrated";

const EMPTY: string[] = [];

/**
 * 이 코스에서 내가 어디까지 아는가.
 *
 * 어느 지역을 맞혔는지는 따로 저장하지 않는다. 해 본 코스에서 헷갈리는
 * 목록에 없는 곳을 언젠가 맞힌 곳으로 본다. 완벽한 추론은 아니지만 이 값이
 * 답하려는 질문("어디가 남았나")에는 충분하고, 정확히 하려고 지역마다 정답
 * 이력을 쌓기 시작하면 기기에 남는 것만 늘어난다.
 *
 * 해 본 적이 없으면 빈 배열이다 — 첫 방문자의 지도는 색이 없어야 한다.
 */
export function useMastery(
  courseId: string,
  geo: CourseGeo | null | undefined,
): { known: string[]; confusing: string[] } {
  const hydrated = useIsHydrated();

  return useMemo(() => {
    if (!hydrated || !geo) return { known: EMPTY, confusing: EMPTY };

    const course = getCourse(courseId);
    const stuck = new Set(loadMistakes(courseId).map((r) => r.code));
    const played =
      stuck.size > 0 ||
      (course
        ? ["map", "learn"].some((mode) =>
            loadPersonalBest(courseId, mode as never, course.version),
          )
        : false);

    if (!played) return { known: EMPTY, confusing: EMPTY };

    return {
      known: geo.regions.map((r) => r.code).filter((code) => !stuck.has(code)),
      confusing: [...stuck],
    };
  }, [hydrated, courseId, geo]);
}
